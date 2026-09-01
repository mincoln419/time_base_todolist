# daily-idea-note Gap Analysis Report

> **Match Rate**: 100% (1차 gap-detector 92% → 발견된 Gap 전부 수정·재검증 후)
> **Date**: 2026-08-30
> **Status**: Check Complete (>=90%)
> **Design Doc**: [daily-idea-note.design.md](../02-design/features/daily-idea-note.design.md)

---

## Overall Scores

| 카테고리 | 점수 | 상태 |
|----------|:----:|:----:|
| §3.3 DB 스키마 | 100% | OK |
| §4 API 스펙 + §6 에러 처리 | 100% | OK |
| §5.3 Component List | 100% | OK (수정 완료) |
| §5.4 UI 체크리스트 | 100% | OK (수정 완료) |
| §5.5 마인드맵 연결/레이아웃 알고리즘 | 100% | OK |
| §7/§9/§10 아키텍처·컨벤션 | 100% | OK (수정 완료) |
| 백업 연동 (Design 범위 외, 프로젝트 공통 컨벤션) | 100% | OK (Check 단계에서 신규 발견·수정) |
| **전체 Match Rate** | **100%** | **OK** |

`gap-detector` 에이전트의 1차 분석 결과(Design 범위 98% / 백업 연동 포함 전체 92%)를 받은 뒤, 발견된 항목을 모두 재검증하고 수정했다. 아래는 항목별 판단과 조치 내역이다.

---

## 1. Design 문서 대비 구현 확인 (수정 전 98%)

`server/db/schema.sql`(daily_notes 테이블+인덱스), `server/routes/dailyNotes.js`, `server/index.js` 등록, `client/src/api/dailyNotes.js`, `client/src/hooks/useDailyNotes.js`, `client/src/components/DailyNote/*.jsx`, `App.jsx` 탭 등록을 Design §3~§10과 전항목 대조했다.

| 항목 | 상태 | 비고 |
|------|:--:|------|
| §3.3 DB 스키마 (컬럼 8개 + 인덱스) | Done | 문서와 동일 |
| §4 API 4개 엔드포인트 + §6 에러 처리 | Done | keyword 필수, content 2000자 검증, date 기본값, `{error}` 포맷 전부 일치 |
| §5.4 UI 체크리스트 (폼/목록/캘린더/마인드맵) | Done | 필드·카운터·필터·뷰 전환 전부 구현 |
| §5.5 마인드맵 연결 규칙(카테고리 일치 OR 키워드 교집합) + 허브(최고 차수, 동률 시 최소 id)-스포크 레이아웃 | Done | `DailyNoteMindMapView.jsx`의 `buildEdges`/`findComponents`/`layoutComponent`가 설계 그대로 |
| §7/§10 마크다운 렌더링에 `UnconsciousWorries.jsx`/`Calendar.jsx`를 import하지 않고 로컬 재구현, `.markdown-body` 클래스 재사용(`prose` 아님) | Done | `DailyNoteCalendarView.jsx`에 `buildGrid`/`toDateString`/`WEEKDAYS` 로컬 복제 확인 |
| 파라미터 바인딩만 사용(SQL 문자열 concat 없음) | Done | `dailyNotes.js` 전체 `?` 바인딩 |

### 발견된 Gap과 조치

| # | 심각도 | Design 대비 차이 | 조치 |
|---|:--:|---|------|
| 1 | Medium | §5.3은 `DailyNote.jsx`가 `noteLabel`을 정의해 하위 컴포넌트에 **props로 전달**하도록 명시했으나, 실제로는 `DailyNote.jsx`가 `noteLabel`/`renderNoteMarkdown`을 export하고 세 뷰 컴포넌트가 `./DailyNote`에서 다시 import하는 **순환 참조** 구조였음 (동작은 하지만 취약한 패턴) | `client/src/components/DailyNote/noteUtils.js`를 신설해 두 함수를 이동, `DailyNote.jsx`와 세 뷰 컴포넌트 모두 `./noteUtils`에서 import하도록 변경 — 순환 참조 제거, §10.4 "로컬 작성" 의도도 "공용 리프 모듈"로 자연스럽게 충족 |
| 2 | Low | §5.4 캘린더 뷰 날짜 상세 패널이 "제목/키워드"를 요구했으나 실제로는 `noteLabel`(제목)만 표시하고 키워드 배지가 빠져 있었음 (목록 뷰는 정상 표시) | `DailyNoteCalendarView.jsx` 날짜 패널에 키워드 배지 추가, 목록 뷰와 동일한 표현으로 통일 |

브라우저에서 재검증: 마크다운 굵게(`**텍스트**`)가 `.markdown-body`로 정상 렌더링되고, 순환 참조 제거 후에도 목록/캘린더/마인드맵 3개 뷰 모두 콘솔 에러 없이 정상 동작함을 확인했다.

---

## 2. 프로젝트 공통 백업 컨벤션 (Design 범위 밖 발견, 수정 전 0%)

Design 문서에는 명시되지 않았지만, 이 프로젝트의 모든 탭은 `server/routes/backup.js`의 `BACKUP_TYPES`에 자기 테이블을 등록하고 `client/src/components/BackupControls.jsx`의 `TYPE_LABELS`에 라벨을 등록하는 것이 확립된 관례다(직전 `team-status-board`/`warroom` Check 단계에서 동일한 유형의 Gap이 발견·수정된 전례가 있음 — [team-status-board.analysis.md](./team-status-board.analysis.md) §2.1 #5 참조).

`gap-detector`가 이 관례를 `daily_notes`에 적용해 대조한 결과, **완전히 누락**되어 있었다.

| 심각도 | Gap | 조치 |
|:--:|---|------|
| High | `BACKUP_TYPES.full.tables`/`deleteTables`에 `daily_notes`가 없어, "전체" 백업을 내보내도 데일리노트가 포함되지 않고 그 백업으로 복원하면 기존 데일리노트가 전부 삭제됨(다른 15개 테이블만 복원) | `full.tables`/`full.deleteTables`에 `daily_notes` 추가 |
| High | `BACKUP_TYPES`에 `dailynote` 전용 항목이 없어 `getBackupType('dailynote')`가 `'full'`로 조용히 폴백 — "데일리노트 내보내기" 버튼을 눌러도 실제로는 전체 DB가 내려받아짐(라벨과 동작 불일치) | `dailynote: { label: '데일리노트', tables: ['daily_notes'], deleteTables: ['daily_notes'] }` 추가 |
| Medium | `BackupControls.jsx`의 `TYPE_LABELS`에 `dailynote`가 없어, 데일리노트 백업 파일을 가져오기할 때 확인 대화상자가 "전체 데이터가 교체됩니다"로 표시될 위험 | `TYPE_LABELS`에 `dailynote: '데일리노트'` 추가 |

**재검증**: 서버 재시작 후 `curl 'localhost:3001/api/backup/export?type=dailynote'` → `label: '데일리노트'`, `data.daily_notes` 포함 확인. `curl 'localhost:3001/api/backup/export?type=full'` → `data.daily_notes` 포함 확인. 브라우저에서 데일리노트 탭 진입 시 하단 버튼이 "데일리노트 내보내기"로 정확히 표시됨을 확인.

---

## 3. Gap 아님으로 판정한 항목

`gap-detector`가 Info 수준으로 보고한 "`content ?? ''`가 `null` 대신 빈 문자열을 저장하고, 문자열이 아닌 `content`는 길이 검증을 우회한다"는 지적은 실제 코드베이스 관례와 대조한 결과 **Gap 아님**으로 판정했다. `server/routes/tasks.js`의 `title` 검증(`!title || !title.trim()`)도 동일하게 비문자열 입력에 대한 타입 가드가 없으며, 이 프로젝트는 클라이언트가 항상 문자열을 보내는 로컬 단일 사용자 앱 특성상 이런 방어적 타입 체크를 어디에도 두지 않는다. 이 라우트에만 개별적으로 타입 가드를 추가하면 오히려 컨벤션과 어긋나므로 수정하지 않는다.

---

## 4. 회귀 확인

- 기존 탭(일정관리/포커스맵/고객사/캘린더/고민목록/장기목표/업무 배치 보드) 코드는 `App.jsx`의 `TABS` 배열 항목 추가, 렌더 분기 1개 추가 외에 변경 없음.
- 기존 `tasks`/`schedules`/`focus_map`/`warroom_*` 등 테이블·라우트 무변경 (신규 테이블 `daily_notes`만 추가).
- `backup.js` 수정이 기존 `full`/`schedule`/`focusmap`/`customers`/`calendar`/`worries`/`longgoals`/`warroom` 백업 타입의 테이블 목록에 영향을 주지 않았는지 확인 — 기존 배열은 그대로 두고 `daily_notes` 관련 항목만 추가.
- `npx vite build` 성공 (수정 전후 2회 모두 확인).
- 브라우저 수동 시나리오: 노트 작성(마크다운 굵게/목록 렌더링) → 목록/캘린더(날짜별 배지+키워드 상세 패널)/마인드맵(연관 키워드로 클러스터 연결 확인) 3개 뷰 교차 확인, 콘솔 에러 없음.

---

## 5. 결론

Match Rate **100%** — Design 문서 범위(§3~§10)는 전항목 구현 완료, Check 단계에서 발견한 순환 참조·캘린더 키워드 누락 2건을 수정했다. 또한 Design 범위 밖이지만 프로젝트 전체에 적용되는 백업 컨벤션 미연동(3건, High 2 / Medium 1)을 `warroom` 선례와 동일하게 신규 발견해 수정·재검증했다. Report 단계로 진행 가능.
