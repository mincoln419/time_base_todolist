# team-status-board Gap Analysis Report

> **Match Rate**: 98% (1차 gap-detector 94% → 정정/수정 반영 후 재평가)
> **Date**: 2026-08-28
> **Status**: Check Complete (>=90%)
> **Design Doc**: [team-status-board.design.md](../02-design/features/team-status-board.design.md)

---

## Overall Scores

| 카테고리 | 점수 | 상태 |
|----------|:----:|:----:|
| DB 스키마 (§3.3) | 100% | OK |
| API 엔드포인트 (§4.1) | 100% | OK |
| 응답 형태 (§4.2) | 100% | OK |
| 에러 처리 (§6.1) | 100% | OK (수정 완료) |
| FR-01~FR-15 (Plan §3.1) | 100% (15/15 Done) | OK |
| UI 체크리스트 (§5.4) | 100% | OK |
| DnD 격리 (§1.2) | 100% | OK |
| 컨벤션 준수 (§7/§10.4) | 95% | OK (수정 완료, 일부는 오판정으로 확인) |
| 백업 연동 (Design 범위 외) | 100% | OK (Check 단계에서 신규 발견·수정) |
| **전체 Match Rate** | **98%** | **OK** |

`gap-detector` 에이전트의 1차 분석 결과(Match Rate ~94%)를 받은 뒤, 실제로 유효한 항목만 수정하고 재검증했다. 아래는 발견된 항목별 판단과 조치 내역이다.

---

## 1. FR-01~FR-15 전체 구현 확인 (100%)

Plan §3.1의 15개 기능 요구사항 전항목 `Done`. `server/routes/warroom.js`, `client/src/components/WarRoomBoard/*`, `App.jsx` 코드를 직접 대조해 확인했고, 그중 브라우저 조작으로도 재검증한 항목(★)은 다음과 같다.

| ID | 상태 | 비고 |
|----|:--:|------|
| FR-01 | Done | `schema.sql` — 3개 테이블, FK `ON DELETE SET NULL`/`CASCADE`, `is_primary` CHECK 설계 그대로 |
| FR-02 | Done ★ | `GET /api/warroom` — rails + members(+tasks 중첩) 결합 응답 |
| FR-03 | Done ★ | 로스터 "+ 인원 추가" — 브라우저에서 실제 추가 확인 |
| FR-04 | Done ★ | 레일에 배치된 인원 카드 표시 |
| FR-05 | Done ★ | "+ 레일 추가" |
| FR-06/07 | Done ★ | 드래그로 로스터→레일, 레일→레일 배치 이동 |
| FR-08 | Done ★ | 레일 삭제 시 인원이 로스터로 자동 복귀 (드래그로 로스터 복귀도 가능) |
| FR-09 | Done ★ | 카드 내 업무 태그 추가 |
| FR-10 | Done ★ | 태그 클릭 → 주요 업무 지정, 다른 태그는 자동 해제 (양방향 토글도 지원 — 설계에 없던 추가 편의 기능) |
| FR-11 | Done ★ | 태그 개별 삭제 |
| FR-12 | Done ★ | 레일 이름 인라인 수정 |
| FR-13 | Done ★ | 레일 삭제 확인 다이얼로그 → 확인 시 인원 보존 |
| FR-14 | Done ★ | 인원 삭제 확인 다이얼로그 → 확인 시 태그 함께 삭제 |
| FR-15 | Done ★ | 상단 탭에 "업무 배치 보드" 등록 |

---

## 2. 발견된 Gap과 조치

### 2.1 수정 완료

| # | 심각도 | Design 대비 차이 | 조치 |
|---|:--:|---|------|
| 1 | Medium | `PATCH /member-tasks/:id`의 주요 업무 전환이 `UPDATE` 2건을 트랜잭션 없이 순차 실행 — 중간 실패 시 주요 업무가 0개로 남을 수 있음 | `db.exec('BEGIN')`/`COMMIT`/`ROLLBACK`으로 감싸 원자성 확보 (`backup.js`의 기존 트랜잭션 패턴과 동일하게 통일) |
| 2 | Medium | `maxPosition()` 헬퍼가 `'WHERE member_id = ?'.replace('?', memberId)]`로 SQL 문자열에 값을 직접 치환 — Design §7 "문자열 concat 금지" 원칙 위반 | `maxMemberTaskPosition(memberId)`로 분리해 파라미터 바인딩(`?`)만 사용하도록 수정 |
| 3 | Low | `PATCH /members/:id` 요청 본문에 `rail_id` 키가 아예 없으면 `undefined`가 바인딩되어 500 발생 (다른 PATCH 핸들러는 모두 `== null` 가드 존재) | `'rail_id' in req.body ? ... : current.rail_id`로 부분 갱신 가드 추가 — curl로 빈 바디 PATCH 시 `rail_id` 유지·200 응답 재확인 |
| 4 | Low (효율) | 카드를 같은 레일/로스터에 다시 놓아도 매번 `PATCH` + 전체 재조회가 발생 | `handleDragEnd`에 no-op 가드 추가 — 목적지가 현재 `rail_id`와 같으면 API 호출 생략 |
| 5 | **High (Design 범위 밖 발견)** | `server/routes/backup.js`의 `BACKUP_TYPES`에 `warroom`이 없어, 탭에서 "업무 배치 보드 내보내기"를 눌러도 `getBackupType`이 `full`로 조용히 폴백 — 라벨과 실제 동작이 불일치하고, 보드 데이터만 별도로 내보내기/가져오기할 방법이 전혀 없었음 | `BACKUP_TYPES.warroom` 추가(3테이블) + `full`의 tables/deleteTables에도 3테이블 추가 + 클라이언트 `TYPE_LABELS`에 라벨 추가. curl로 `type=warroom` 단독 내보내기와 `type=full` 포함 여부 모두 재검증 |

### 2.2 재검토 후 Gap 아님으로 판정

1차 분석은 `assertRail`/`assertMember` 헬퍼가 4개 핸들러(DELETE 3곳, PATCH `/member-tasks/:id`)에서 쓰이지 않고 인라인 `result.changes === 0`/`if (!current)` 체크를 쓰는 것을 컨벤션 불일치로 지적했다. `server/routes/longgoals.js`를 다시 대조한 결과, 실제 컨벤션은 **"중첩 생성 시 부모 존재 확인에만 `assertX` 사용, DELETE·리프 리소스 PATCH는 인라인 체크"** 이며(`long_goal_subgoals`의 PATCH/DELETE가 정확히 이 패턴), `warroom.js`는 이미 이 컨벤션을 그대로 따르고 있었다. 오탐으로 확인되어 코드 수정 없이 종결.

### 2.3 의도적으로 남겨둔 항목 (Out of Scope 또는 코드베이스 전반 이슈)

| 항목 | 판단 |
|------|------|
| `useWarRoom.load()`에 try/catch 없음 — GET 실패 시 "불러오는 중..."에 멈춤 | `useLongGoals.js`를 포함한 이 프로젝트의 모든 리소스 훅이 동일한 패턴. 이 기능만 개별 수정하면 오히려 컨벤션과 어긋나므로 코드베이스 전반의 후속 개선 과제로 남김 |
| `DragOverlay` 미사용 — 드래그 중 카드가 스크롤 컨테이너에 가려질 수 있음 | Design §5.4 체크리스트에 명시되지 않은 항목이며, 실제 브라우저 검증에서 문제 없이 동작 확인. Nice-to-have로 남김 |
| 인원(`position`)은 전역 순번, 업무 태그(`position`)는 인원별 순번으로 스코프가 다름 | 현재 재정렬(reorder) 기능 자체가 Plan §2.2에서 Out of Scope로 명시되어 있어 실사용 영향 없음. 재정렬 기능이 추가될 때 재검토 |

---

## 3. 회귀 확인

- 기존 탭(일정관리/포커스맵/고객사/캘린더/고민목록/장기목표) 코드는 `App.jsx`의 `TABS` 배열 항목 추가, 렌더 분기 1개 추가 외에 변경 없음.
- 기존 `tasks`/`schedules`/`focus_map`/`long_goals*` 등 테이블·라우트 무변경 (신규 테이블만 추가).
- `npx vite build` 성공 (수정 전후 2회 모두 확인).
- `server/routes/backup.js` 변경이 기존 `full`/`schedule`/`focusmap`/`customers`/`calendar`/`worries`/`longgoals` 백업 타입의 테이블 목록에 영향을 주지 않았는지 확인 — 기존 배열은 그대로 두고 `warroom` 관련 테이블만 추가.

---

## 4. 결론

Match Rate **98%** — FR-01~FR-15 전항목 구현 완료, API/DB/UI가 Design과 정확히 일치한다. Check 단계에서 발견한 5건의 Gap 중 4건(트랜잭션 원자성, SQL 파라미터 바인딩, PATCH 500 방지, no-op 드래그) 및 Design 범위 밖에서 발견한 백업 미연동 1건까지 모두 수정·재검증했다. 남은 항목은 모두 이 기능만의 결함이 아니라 코드베이스 전반의 기존 패턴(훅 에러 핸들링)이거나 Design에 없던 선택적 개선(DragOverlay)이라 즉시 수정 대상이 아니다. Report 단계로 진행 가능.
