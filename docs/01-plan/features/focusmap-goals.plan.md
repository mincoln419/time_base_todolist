---
template: plan
version: 1.3
---

# focusmap-goals Planning Document

> **Summary**: 포커스 맵을 목표별로 여러 개 저장하고, 탭 좌측 목록에서 골라 이어보거나, 결과 화면에서 선택한 행동을 일정관리 할일 목록으로 바로 전환하는 기능
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-04
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 포커스 맵은 세션을 1개만 저장해 다른 목표로 다시 시작하면 이전 결과가 사라지고, "겹쳐 보기" 결과(황금 행동 등)를 실행하려면 일정관리 탭에 수작업으로 다시 입력해야 한다 |
| **Solution** | 포커스 맵 저장 구조를 목표(goal)별 다중 세션으로 바꾸고, 탭 좌측에 저장된 목표 리스트를 추가해 선택 시 이어보기/열람하게 한다. 결과 화면에는 항목별 체크박스를 두어, 선택한 행동을 기존 할일 백로그(tasks)에 바로 추가하는 버튼을 제공한다 |
| **Function/UX Effect** | 여러 목표를 오가며 반복 사용할 수 있고, 분석 결과가 별도 타이핑 없이 실제 하루 일정(드래그 배치 가능한 할일)으로 바로 이어진다 |
| **Core Value** | "생각 정리(포커스 맵) → 실행(할일 목록)" 사이의 손실을 없애, 포커스 맵을 반복 사용하는 우선순위 관리 습관 도구로 만든다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 단일 세션 구조라 목표별 재사용이 불가능하고, 분석 결과가 실행(할일)로 이어지지 않음 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 여러 목표를 오가며 하루 계획을 짜는 사람 |
| **RISK** | 단일 row → 목표별 다중 row로의 스키마 변경, 기존 세션 데이터 이관 여부 |
| **SUCCESS** | 좌측 목록에서 저장된 목표를 선택해 이어보기 가능 + 겹쳐보기 화면에서 선택한 항목이 할일 백로그에 실제로 추가됨 |
| **SCOPE** | (1) focus_map 스키마 변경 (2) 서버 API 확장 (3) 좌측 목표 리스트 UI (4) 결과 화면 체크박스 + 변환 버튼 (5) tasks API 연동 |

---

## 1. Overview

### 1.1 Purpose

포커스 맵(BJ Fogg 행동 설계) 기능에 "여러 목표를 저장/재사용"하는 기록 기능과, 분석 결과를 실제 할일로 옮기는 실행 연결 고리를 추가한다.

### 1.2 Background

현재 `focus_map` 테이블은 단일 row(`id = 1`)만 사용하는 구조로, 새 목표를 시작하면 이전 목표의 진행 내역이 덮어써진다. 또한 "겹쳐 보기" 결과는 화면에만 표시될 뿐, 일정관리 탭의 할일 백로그(`tasks` 테이블)로 옮기려면 사용자가 직접 다시 입력해야 한다. 이번 기능은 지난 대화에서 사용자와 다음 사항을 확정했다:

- 목표(goal) 이름은 **고유 키**로 취급 — 같은 이름으로 다시 저장하면 기존 세션을 덮어쓴다.
- 할일로 변환할 항목은 **결과 화면에서 사용자가 체크박스로 직접 선택**한다 (황금 행동만 자동 선정하지 않음).
- 변환된 항목은 **기존 일정관리 탭의 할일 백로그(`tasks` 테이블)에 추가**되어, 곧바로 드래그로 시간표에 배치할 수 있다.
- 좌측 목록에서 목표를 클릭하면 **저장 당시의 단계(행동 모으기~겹쳐 보기)를 그대로 불러와 이어서 진행/열람**한다.

### 1.3 Related Documents

- 선행 구현(단일 세션 MVP): `client/src/components/FocusMap/FocusMap.jsx`, `client/src/hooks/useFocusMap.js`, `server/routes/focusmap.js`, `server/db/schema.sql`
- 참고: `docs/archive/2026-05/time-based-todolist/` (기존 일정관리 기능 PDCA 문서)

---

## 2. Scope

### 2.1 In Scope

- [ ] `focus_map` 테이블을 "목표별 다중 세션" 구조로 변경 (goal을 UNIQUE 키로 사용)
- [ ] 세션 목록 조회 / 단건 조회 / 생성 / 수정 / 삭제 API로 확장
- [ ] FocusMap 탭을 좌(목표 리스트) · 우(기존 작업 화면) 2단 레이아웃으로 변경
- [ ] 좌측 목록: 목표명 · 마지막 수정일 · 진행 단계 배지 · 황금 행동 수 표시, 클릭 시 해당 세션 로드
- [ ] "새 목표 시작" 버튼 — 좌측 목록에 없는 빈 세션에서 새로 작성 시작
- [ ] 좌측 목록에서 저장된 목표 삭제
- [ ] "겹쳐 보기" 결과 표에 행별 체크박스 추가
- [ ] "할일로 추가" 버튼 — 선택된 항목을 기존 `POST /api/tasks`로 전송해 할일 백로그에 추가
- [ ] 이미 할일로 추가한 항목은 표/체크박스에서 "추가됨"으로 구분 (같은 세션 내 중복 추가 방지)

### 2.2 Out of Scope

- 저장된 목표 이름 변경(rename)·병합 기능
- 할일 백로그로 보낸 항목과 포커스 맵 항목 간의 양방향 동기화 (예: 할일 완료 시 포커스 맵 쪽 상태 갱신, 할일 삭제 시 "추가됨" 표시 해제)
- 여러 목표를 동시에 나란히 비교하는 화면
- 세션 export/공유, 여러 기기 간 동기화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `focus_map` 테이블은 `id`(PK), `goal`(UNIQUE), `items`/`step`/`cursor`/`added_task_ids`를 담은 `data`(JSON), `updated_at`을 저장한다 | High | Pending |
| FR-02 | `GET /api/focusmap`는 저장된 모든 세션의 요약 리스트(`id, goal, updatedAt, step, itemCount, goldCount`)를 `updated_at desc`로 반환한다 | High | Pending |
| FR-03 | `GET /api/focusmap/:id`는 해당 세션의 전체 상태(goal, items, step, cursor, addedTaskIds)를 반환한다 | High | Pending |
| FR-04 | `POST /api/focusmap`는 새 세션을 생성한다 (goal 필수, 공백/중복 시 400/409) | High | Pending |
| FR-05 | `PUT /api/focusmap/:id`는 해당 세션을 갱신한다 (goal 변경 시 중복이면 409) | High | Pending |
| FR-06 | `DELETE /api/focusmap/:id`는 해당 세션을 삭제한다 | Medium | Pending |
| FR-07 | 0단계(행동 모으기)는 "영향력부터 매기기"를 누르기 전까지 로컬 상태로만 유지되며, 그 시점에 `POST`로 새 세션이 생성되어 좌측 목록에 나타난다 | High | Pending |
| FR-08 | FocusMap 탭 좌측에 저장된 목표 리스트를 표시하고, 클릭 시 해당 세션을 불러와 저장된 단계 그대로 이어보기/열람한다 | High | Pending |
| FR-09 | "새 목표 시작" 버튼으로 좌측 목록과 무관한 새 초안(0단계)을 시작할 수 있다 | Medium | Pending |
| FR-10 | 좌측 목록 항목마다 삭제 버튼을 제공하고, 삭제 시 `DELETE /api/focusmap/:id` 호출 후 목록을 갱신한다 | Medium | Pending |
| FR-11 | "겹쳐 보기" 결과 표의 각 행에 체크박스를 추가한다 | High | Pending |
| FR-12 | 체크박스로 선택한 항목에 대해 "할일로 추가" 버튼을 누르면 각 항목 제목으로 기존 `POST /api/tasks`를 호출한다 | High | Pending |
| FR-13 | 이미 할일로 추가된 항목의 id는 세션 상태(`addedTaskIds`)에 저장되어, 재방문 시에도 "추가됨" 표시가 유지되고 체크박스가 비활성화된다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 데이터 무결성 | goal이 빈 문자열이거나 공백뿐이면 세션 생성/좌측 목록 노출 안 함 | 수동 테스트 |
| 일관성 | 할일 변환은 기존 `tasks` 테이블/`POST /api/tasks` 검증 로직을 그대로 재사용 (별도 검증 로직 신설 금지) | 코드 리뷰 |
| 회귀 방지 | 기존 단일 세션 MVP의 사용자 흐름(모으기→1판→2판→겹쳐보기, 다시 매기기, 처음부터)이 그대로 동작 | 수동 테스트 |
| 규모 가정 | 로컬 단일 사용자 SQLite 환경 — 목표 수 수십 개 수준을 가정, 페이지네이션/캐싱 불필요 | 해당 없음 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 서로 다른 목표 2개 이상으로 각각 포커스 맵을 진행하고 저장할 수 있다
- [ ] 좌측 목록에서 목표를 선택하면 저장된 진행 단계 그대로 이어보기/열람된다
- [ ] "새 목표 시작"으로 기존 목록에 영향 없이 새 세션을 시작할 수 있다
- [ ] 좌측 목록에서 목표를 삭제할 수 있다
- [ ] 겹쳐 보기 결과에서 항목을 선택해 "할일로 추가"하면 일정관리 탭 할일 백로그에 즉시 나타난다
- [ ] 이미 추가한 항목은 재방문해도 "추가됨" 상태가 유지된다
- [ ] 기존 일정관리 탭 및 기존 단일 세션 MVP 흐름에 회귀 없음

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(2개 목표 저장→전환→할일 변환→재방문 확인) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 기존 단일 세션(`id=1`) 데이터가 스키마 변경 시 유실 | Medium | Medium | 개발용 로컬 데이터이므로 초기화 허용 여부를 Design 단계에서 확인하고, 필요 시 `id=1` row를 `goal` 값으로 1회 이관하는 마이그레이션 스크립트 작성 |
| 목표명 오타 시 새 세션처럼 분리되어 이전 진행 내역과 단절 (rename 미지원) | Low | Medium | Out of Scope로 명시, 문제가 반복되면 후속 PDCA 사이클에서 rename 기능 별도 기획 |
| 할일 백로그에서 항목을 삭제해도 포커스 맵 쪽 "추가됨" 표시가 갱신되지 않아 상태 불일치 | Low | Medium | 양방향 동기화는 Out of Scope로 명시. Design 문서에 알려진 제약으로 기록 |
| 좌측 목록 추가로 인한 레이아웃 변경이 기존 단일 컬럼 UX와 충돌 | Low | Low | 좌측 목록은 접기/펼치기 없이 고정 폭 사이드바로 단순 배치, 기존 우측 작업 화면 로직은 그대로 재사용 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `focus_map` 테이블 | DB Schema | 단일 row(`id=1`) 구조 → `id` PK + `goal` UNIQUE의 다중 row 구조로 변경 (breaking) |
| `/api/focusmap` | API | 인자 없는 단일 세션 GET/PUT/DELETE → 목록 조회(`GET /`) + 단건 CRUD(`GET/PUT/DELETE /:id`) + 생성(`POST /`)로 확장 (breaking) |
| `client/src/hooks/useFocusMap.js` | Hook | 단일 상태 훅 → 목록 조회 훅 + 세션별 상태 훅으로 분리 예정 (Design에서 확정) |
| `client/src/components/FocusMap/FocusMap.jsx` | Component | 좌측 목록 + 우측 작업 화면 2단 레이아웃으로 재구성 |
| `tasks` 테이블 / `POST /api/tasks` | API (기존, read-only 재사용) | 스키마·로직 변경 없음. 포커스 맵에서 새 호출 지점만 추가됨 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `focus_map` (단일 세션) | READ/WRITE | `useFocusMap.js` → `api/focusMap.js` → `GET/PUT/DELETE /api/focusmap` | Breaking — API 시그니처가 바뀌므로 훅/컴포넌트 전면 재작성 필요 |
| `tasks` | CREATE | `TaskBacklog.jsx` → `useTasks.addTask` → `POST /api/tasks` | None — 포커스 맵이 동일한 API를 호출만 추가, 기존 경로 변경 없음 |
| `tasks` | READ | `App.jsx` → `useTasks()` → `GET /api/tasks` | None — 포커스 맵에서 추가한 항목도 동일하게 조회됨 (자연스럽게 반영) |

### 6.3 Verification

- [ ] 포커스 맵 관련 코드 전체(hook, component, api, route, schema)가 새 다중 세션 구조로 일관되게 재작성되었는지 확인
- [ ] `tasks` 관련 기존 코드(TaskBacklog, useTasks, tasks.js)는 수정하지 않고 그대로 재사용했는지 확인
- [ ] 기존 `focus_map` 단일 row 데이터의 처리 방침(이관 또는 초기화)이 Design 단계에서 결정되었는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 bkit의 Starter/Dynamic/Enterprise(Next.js/bkend.ai 프리셋) 분류 대상이 아닌, React(Vite) + Express + SQLite(`node:sqlite`) 커스텀 스택이다. 아래 표는 실제 스택 기준으로 작성한다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 상태 관리 | 로컬 React state + custom hook | 기존 `useTasks`/`useSchedules` 패턴 재사용 (Redux/Zustand 등 신규 도입 안 함) |
| API 클라이언트 | 순수 `fetch` 래퍼 (`api/*.js`) | 기존 컨벤션 재사용 |
| 백엔드 | Express + `better-sqlite3` 스타일 동기 호출(`node:sqlite`) | 기존과 동일 |
| DB | SQLite 파일 (`data/todo.db`) | 기존과 동일, 테이블 스키마만 변경 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 세션 식별 키 | (A) `goal` 문자열을 PK로 사용 / (B) `id` AUTOINCREMENT PK + `goal` UNIQUE 컬럼 | **(B)** | 한글 목표명을 URL 경로에 그대로 쓰면 인코딩 이슈가 있고, PK를 id로 두면 향후 rename 확장 여지가 남는다. `goal UNIQUE` 제약으로 "고유 목표명" 요구사항은 그대로 충족 |
| 저장 시점 | (A) 목표 입력 즉시 저장(keystroke마다 upsert) / (B) "영향력부터 매기기" 클릭 시점에 최초 저장(POST), 이후 PUT으로 갱신 | **(B)** | 0단계 초안 상태에서 매 keystroke마다 목표명 중복 검사가 발생하는 것을 피하고, "저장된 목표"라는 개념을 사용자 행동(1단계 진입)과 명확히 일치시킴 |
| "추가됨" 상태 저장 위치 | (A) 별도 매핑 테이블(`focus_map_task_link`) / (B) 세션 JSON 안에 `addedTaskIds` 배열로 포함 | **(B)** | 양방향 동기화가 Out of Scope이므로 별도 테이블/외래키 없이 세션 JSON에 단순 배열로 기록하는 것으로 충분 (기존 "JSON으로 저장" 원칙 유지) |
| 좌측 목록 갱신 방식 | (A) 실시간 polling / (B) 저장·삭제 성공 시점에만 목록 재조회 | **(B)** | 단일 사용자 로컬 앱이므로 polling 불필요, 기존 훅들의 "액션 후 로컬 상태 갱신" 패턴과 일치 |

### 7.3 폴더 구조 변화 (예상)

```
server/
├── db/schema.sql            # focus_map 테이블 정의 변경
├── routes/focusmap.js        # GET/, GET/:id, POST/, PUT/:id, DELETE/:id 로 확장
client/src/
├── api/focusMap.js           # listFocusMaps, fetchFocusMap(id), createFocusMap, saveFocusMap(id), deleteFocusMap(id)
├── hooks/
│   ├── useFocusMapList.js    # 좌측 목록 조회/삭제 (신규)
│   └── useFocusMap.js        # 활성 세션 로드/저장/생성 (기존 훅 재작성)
└── components/FocusMap/
    ├── FocusMap.jsx           # 좌(목록) + 우(작업 화면) 레이아웃 컨테이너로 재구성
    ├── FocusMapList.jsx       # 좌측 목표 리스트 (신규)
    └── (기존 단계별 렌더링은 FocusMap.jsx 내부에 유지)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [ ] 별도 `docs/01-plan/conventions.md` 없음 — 기존 코드 스타일(컴포넌트/훅/라우트 1:1 대응 패턴)을 컨벤션으로 간주하고 따른다
- [ ] ESLint/Prettier/TS 설정 없음 — 신규 도입하지 않음 (프로젝트 범위 밖)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| API 응답 형태 | 목록 API 없음(기존은 단일 객체) | 목록 API는 배열, 단건 API는 객체 — 기존 `tasks`/`schedules` 목록 API와 동일한 형태로 통일 | High |
| 에러 메시지 | 한국어 메시지, `{ error: '...' }` 형태 (기존) | 신규 라우트도 동일 포맷 유지 (goal 중복 시 409 + 한국어 메시지) | High |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`focusmap-goals.design.md`) — 위 Architecture Decisions를 바탕으로 API 상세 스펙, 컴포넌트 상세 구조, 기존 단일 세션 데이터 이관 방침 확정
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do focusmap-goals`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-04 | Initial draft | Mincoln Cho |
