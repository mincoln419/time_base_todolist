---
template: plan
version: 1.3
---

# meeting-minutes Planning Document

> **Summary**: 회의록을 날짜별로 기록하는 새 탭. "전체"(공유/요청/진행프로젝트), "파트별"(담당자/진행사항/요청사항), "액션아이템"(업무구분/내용/상태/기한/담당자) 세 섹션으로 구성되며, 각 섹션은 여러 항목을 자유롭게 추가·수정·삭제할 수 있다
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-01
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 회의 내용(공유사항, 파트별 진행상황, 액션아이템)을 구조적으로 기록·조회할 수 있는 화면이 없어, 매번 별도 문서나 메신저로 흩어져 관리된다 |
| **Solution** | 날짜를 입력해 회의록을 하나 생성하고, 그 안에서 "전체 / 파트별 / 액션아이템" 세 섹션에 각각 여러 항목을 추가·수정·삭제할 수 있는 새 탭을 추가한다. 액션아이템 섹션은 회의 원문 메모를 붙여넣으면 외부 AI API가 자동으로 항목을 추출해 채워준다 |
| **Function/UX Effect** | 기존 장기목표(LongGoals) 탭처럼 목록에서 회의록을 선택해 상세로 들어가고, 상세 화면에서 섹션별로 항목을 인라인으로 추가/수정하는 익숙한 패턴을 그대로 재사용한다. 액션아이템은 수동 입력 외에 "원문 붙여넣기 → AI 자동생성" 경로도 제공한다 |
| **Core Value** | 회의 내용을 날짜 기준으로 구조화해 축적하고, 특히 액션아이템의 상태/기한/담당자를 한눈에 추적할 수 있게 한다. AI 자동생성으로 회의록 정리에 드는 수기 입력 부담을 줄인다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 회의 내용을 기록할 구조화된 화면이 없어 공유사항/파트별 진행상황/액션아이템이 흩어져 관리됨 |
| **WHO** | 회의 결과를 정리하고 액션아이템을 추적해야 하는 사용자(팀 리드/매니저) |
| **RISK** | 세 섹션의 필드 구성이 서로 달라(전체=구분+내용, 파트별=담당자+진행사항+요청사항, 액션아이템=5개 필드) 하나의 공용 테이블로 단순화하기 어려움 — 섹션별 테이블 분리 필요. 또한 외부 AI API 키는 반드시 서버 환경변수로만 보관하고 클라이언트에 노출되지 않아야 함 |
| **SUCCESS** | 날짜 입력으로 회의록 생성 → 세 섹션에 항목 추가/수정/삭제 → 새로고침 후에도 유지 → 목록에서 과거 회의록 재조회. 액션아이템은 원문 붙여넣기만으로 AI가 자동 생성 |
| **SCOPE** | (1) 4개 신규 테이블(meetings + 3개 섹션 항목 테이블) (2) `/api/meetings` REST API (3) 목록+상세 UI (기존 DateNavigator 재사용) (4) 새 탭 등록 (5) 액션아이템 AI 자동생성(서버 사이드 외부 LLM 호출, API 키는 서버 환경변수 전용) |

---

## 1. Overview

### 1.1 Purpose

회의록을 날짜별로 생성하고, "전체 공유사항", "파트별 진행상황", "액션아이템" 세 섹션에 각각 여러 항목을 기록·관리하는 신규 메뉴(탭)를 추가한다.

### 1.2 Background

사용자와의 대화에서 다음을 확정했다:

- 회의록의 입력 항목은 3개 섹션으로 구성된다.
  - **전체**: 공유, 요청, 진행프로젝트 — 회의 전체에 해당하는 공지성 항목
  - **파트별**: 담당자, 진행사항, 요청사항 — 파트(팀)별 진행 상황
  - **액션아이템**: 업무구분, 내용, 상태, 기한, 담당자 — 후속 조치 추적
- 각 섹션은 여러 항목을 담을 수 있어야 한다 (예: "전체" 섹션에 공유 항목 여러 개, 파트별 섹션에 파트 여러 개, 액션아이템 여러 개).
- 회의록에는 **회의 날짜** 입력이 필요하며, 날짜 입력 UI는 기존 다른 메뉴(일정관리 탭의 `DateNavigator`)와 동일한 형태를 사용한다.

### 1.3 Related Documents

- 참고 UI 패턴: `client/src/components/LongGoals/` — 목록에서 항목 선택 → 상세 화면에서 여러 하위 섹션(하위목표/요구사항/보상)에 인라인 추가·수정 폼을 제공하는 구조가 이번 기능과 가장 유사
- 참고 날짜 입력 패턴: `client/src/components/DateNavigator.jsx` (◀ 날짜 ▶ 네비게이터)
- 참고 스키마 패턴: `server/db/schema.sql`의 `long_goals` + `long_goal_subgoals`/`long_goal_requirements`/`long_goal_rewards` (부모 1개 + 성격이 다른 자식 테이블 여러 개)

---

## 2. Scope

### 2.1 In Scope

- [ ] `meetings`(id, date, created_at) 부모 테이블 추가
- [ ] `meeting_overall_items`(id, meeting_id, kind[share/request/project], content, position) 테이블 추가 — "전체" 섹션
- [ ] `meeting_part_items`(id, meeting_id, assignee, progress, request, position) 테이블 추가 — "파트별" 섹션
- [ ] `meeting_action_items`(id, meeting_id, task_type, content, status, due_date, assignee, position) 테이블 추가 — "액션아이템" 섹션
- [ ] `GET/POST/DELETE /api/meetings`, `GET /api/meetings/:id`(섹션 항목 포함 상세) 및 각 섹션 항목별 `POST/PUT/DELETE` REST API
- [ ] 목록 화면 — 날짜 기준 회의록 목록(최신순), 새 회의록 생성(날짜 입력은 기존 `DateNavigator`와 동일한 형태 재사용)
- [ ] 상세 화면 — 세 섹션을 구분해 표시, 섹션별로 항목 추가/인라인 수정/삭제
- [ ] 회의록 삭제(확인 다이얼로그 포함, 섹션 항목도 함께 삭제)
- [ ] 상단 네비게이션에 새 탭 등록("회의록")
- [ ] 액션아이템 섹션에 "회의 원문 붙여넣기 → AI 자동생성" 기능 추가 — 서버가 외부 LLM API(OpenAI 호환 Chat Completions)를 호출해 원문에서 액션아이템 목록을 추출, 결과를 `meeting_action_items`에 일괄 저장
- [ ] AI API 키/엔드포인트는 서버 환경변수(`MEETING_AI_API_KEY` 등)로만 관리 — 코드/DB/클라이언트에 노출 금지

### 2.2 Out of Scope

- 회의 참석자 관리, 회의실/시간 예약 등 회의 자체의 부가 메타데이터
- 액션아이템과 기존 `tasks`(할일 백로그)/`schedules`(시간 블록) 간의 연동 (예: 액션아이템을 바로 할일로 변환)
- 파트/담당자를 별도 마스터 테이블로 관리(자유 텍스트 입력으로 충분)
- 회의록 검색/필터/내보내기(PDF, 공유 링크 등)
- 다중 사용자 동시 편집

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `meetings`, `meeting_overall_items`, `meeting_part_items`, `meeting_action_items` 4개 테이블을 정의한다 | High | Pending |
| FR-02 | 목록 화면에서 날짜를 입력(기존 `DateNavigator`와 동일한 형태)해 새 회의록을 생성할 수 있다 | High | Pending |
| FR-03 | 목록 화면은 생성된 회의록을 날짜 최신순으로 나열하고, 클릭 시 상세 화면으로 이동한다 | High | Pending |
| FR-04 | 상세 화면의 "전체" 섹션에서 구분(공유/요청/진행프로젝트)과 내용을 입력해 항목을 추가할 수 있다 | High | Pending |
| FR-05 | 상세 화면의 "파트별" 섹션에서 담당자/진행사항/요청사항을 입력해 항목(파트)을 추가할 수 있다 | High | Pending |
| FR-06 | 상세 화면의 "액션아이템" 섹션에서 업무구분/내용/상태/기한/담당자를 입력해 항목을 추가할 수 있다 | High | Pending |
| FR-07 | 각 섹션의 항목은 인라인 수정 폼으로 전체 필드를 수정할 수 있다 (기존 장기목표 요구사항/보상 인라인 수정 패턴 재사용) | High | Pending |
| FR-08 | 각 섹션의 항목은 개별 삭제할 수 있다 | High | Pending |
| FR-09 | 액션아이템의 "상태"는 값 목록(예: 대기/진행중/완료) 중에서 선택한다 | Medium | Pending |
| FR-10 | 회의록 자체를 삭제할 수 있다(확인 다이얼로그 포함) — 삭제 시 3개 섹션의 하위 항목도 CASCADE로 함께 삭제된다 | Medium | Pending |
| FR-11 | 상단 네비게이션 탭 목록에 새 탭("회의록")을 추가해 이 화면으로 이동할 수 있다 | High | Pending |
| FR-12 | 액션아이템 섹션에 회의 원문 텍스트를 붙여넣고 "AI 자동생성"을 실행하면, 서버가 외부 LLM API를 호출해 원문에서 액션아이템(업무구분/내용/상태/기한/담당자)을 추출하고 목록에 일괄 추가한다 | High | Pending |
| FR-13 | AI가 응답을 정상적으로 구조화하지 못한 경우에도 원문 텍스트를 잃지 않도록 최소 1개의 항목(원문 요약)으로 대체 저장한다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|---------------------|
| 지속성 | 새로고침·탭 재방문 후에도 회의록과 섹션 항목이 그대로 유지 | 수동 테스트 |
| 격리성 | 새 라우트/컴포넌트/훅은 `meeting` 접두사로 통일, 기존 탭 로직 무변경 | 코드 리뷰 |
| 회귀 방지 | 기존 탭(일정관리/포커스맵/고객사/캘린더/고민목록/장기목표/업무배치보드/설정)의 동작에 영향 없음 | 수동 테스트 |
| 규모 가정 | 로컬 단일 사용자 SQLite 환경 — 회의록 수백 건, 섹션당 항목 수십 개 수준을 가정, 페이지네이션/가상화 불필요 | 해당 없음 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 날짜를 입력해 새 회의록을 생성하면 목록에 나타난다
- [ ] 회의록 상세에서 "전체" 섹션에 항목(구분+내용)을 추가/수정/삭제할 수 있다
- [ ] 회의록 상세에서 "파트별" 섹션에 항목(담당자/진행사항/요청사항)을 추가/수정/삭제할 수 있다
- [ ] 회의록 상세에서 "액션아이템" 섹션에 항목(업무구분/내용/상태/기한/담당자)을 추가/수정/삭제할 수 있다
- [ ] 회의록을 삭제하면 확인 다이얼로그 후 하위 섹션 항목도 함께 삭제된다
- [ ] 브라우저를 새로고침해도 모든 데이터가 그대로 유지된다
- [ ] 기존 다른 탭들의 동작에 회귀 없음

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(회의록 생성 → 세 섹션 각각 항목 2개 이상 추가 → 수정 → 삭제 → 새로고침 확인 → 회의록 자체 삭제) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 세 섹션의 필드 구성이 서로 달라 UI가 복잡해질 수 있음 | Medium | Medium | 장기목표 탭의 "섹션별 카드 리스트 + 인라인 폼" 패턴을 그대로 재사용해 일관성 유지 |
| 액션아이템 "상태" 값 집합이 향후 바뀔 수 있음 | Low | Low | Design 단계에서 `CHECK` 제약과 함께 최소 값 집합(대기/진행중/완료)으로 시작, 확장 필요 시 마이그레이션 |
| 한 날짜에 여러 회의록이 필요한 경우(하루 2회 회의 등) | Low | Medium | `date`에 UNIQUE 제약을 두지 않아 같은 날짜로 여러 회의록 생성 허용 |
| 외부 AI API 키가 코드/저장소에 노출됨 | High | Low | 키는 서버 `.env`(이미 `.gitignore`에 포함)로만 관리, 클라이언트로는 절대 전달하지 않음. 코드/문서에는 실제 키 값을 기록하지 않는다 |
| 외부 AI API 호출 실패/지연(네트워크, 요금, 응답 형식 변경) | Medium | Medium | 실패 시 사용자에게 명확한 에러 메시지 표시 + 수동 입력으로 대체 가능하도록 유지(AI 생성은 어디까지나 보조 기능) |
| AI 응답이 기대한 JSON 형식이 아닐 수 있음 | Medium | Medium | 파싱 실패 시 원문을 하나의 액션아이템(내용 필드)으로 대체 저장해 정보 손실 방지 (FR-13) |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `meetings` / `meeting_overall_items` / `meeting_part_items` / `meeting_action_items` | DB Schema | 신규 테이블 4개 추가 (기존 테이블 무변경) |
| `/api/meetings/*` | API | 신규 라우트 추가 (기존 라우트 무변경) |
| `client/src/App.jsx` | Component | `TABS` 배열에 항목 1개 추가, 탭 렌더 분기 1개 추가 (기존 탭 로직 무변경) |
| `client/src/components/MeetingMinutes/*` (신규) | Component | 목록 + 상세(3섹션) UI 신규 작성, `DateNavigator` 재사용 |
| `client/src/hooks/useMeetings.js` (신규) | Hook | 회의록 목록/상세 조회 및 섹션 항목 CRUD |
| `client/src/api/meetings.js` (신규) | API Client | fetch 래퍼 |
| `server/services/meetingAi.js` (신규) | Service | 외부 LLM API 호출 + 응답 파싱 (기존 `services/notifications.js` 패턴 재사용) |
| `server/package.json` | Dependency | `dotenv` 추가 — `MEETING_AI_API_KEY` 등 환경변수를 `.env`에서 로드 |
| 환경변수 `MEETING_AI_API_URL`/`MEETING_AI_API_KEY`/`MEETING_AI_MODEL` | Config | 신규 — 서버 전용, `.env`(gitignored)에만 기록 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `App.jsx`의 `TABS` | READ/WRITE | 탭 네비게이션 | None — 배열에 항목 추가 및 렌더 분기 추가만, 기존 탭 로직 미변경 |
| `DateNavigator.jsx` | READ | 날짜 입력 UI 재사용 | None — 기존 컴포넌트를 그대로 import해서 사용 |

### 6.3 Verification

- [ ] 신규 테이블/라우트/컴포넌트가 기존 코드와 이름이 겹치지 않는지 확인 (`meeting` 접두사로 통일)
- [ ] `App.jsx` 외 기존 파일은 수정하지 않았는지 확인 (`DateNavigator.jsx`는 import만, 수정 없음)
- [ ] 새 탭 진입/이탈 시 다른 탭 상태에 부작용이 없는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 React(Vite) + Express + SQLite(`better-sqlite3`) 커스텀 스택이다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 상태 관리 | 로컬 React state + custom hook (`useMeetings`) | 기존 `useLongGoals` 패턴 재사용 |
| API 클라이언트 | 순수 `fetch` 래퍼 (`api/meetings.js`) | 기존 컨벤션 재사용 |
| 백엔드 | Express + SQLite (`better-sqlite3`) | 기존과 동일 |
| DB | SQLite 파일 (`data/todo.db`) | 기존과 동일, 신규 테이블만 추가 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 섹션 데이터 모델 | (A) 3섹션을 하나의 공용 `meeting_items` 테이블에 `kind`+JSON 필드로 통합 / (B) 섹션별 전용 테이블 3개 | **(B)** | 섹션마다 필드 구성이 명확히 다르고(전체=2필드, 파트별=3필드, 액션아이템=5필드), `long_goal_subgoals/requirements/rewards`처럼 전용 테이블이 조회·검증이 단순함 |
| "전체" 섹션 내부 구분 | (A) 공유/요청/진행프로젝트를 각각 별도 테이블 / (B) 하나의 `meeting_overall_items`에 `kind` 컬럼으로 구분 | **(B)** | `long_goal_requirements`의 `kind` 패턴과 동일하게, 3개 필드 구성이 동일(구분+내용)하므로 테이블 하나로 충분 |
| 날짜 입력 UI | (A) 신규 date picker 컴포넌트 제작 / (B) 기존 `DateNavigator` 재사용 | **(B)** | 사용자가 명시적으로 "다른 메뉴와 동일한 형태"를 요청 — 일정관리 탭과 동일한 UX 일관성 확보 |
| 목록/상세 화면 구조 | (A) 단일 화면에 모든 회의록 표시 / (B) 목록→상세 네비게이션 | **(B)** | 회의록이 누적되면 한 화면에 다 표시하기 어려움. `LongGoals` 탭과 동일하게 목록에서 선택 후 상세로 진입하는 패턴이 이미 검증됨 |

### 7.3 폴더 구조 변화 (예상)

```
server/
├── db/schema.sql              # meetings / meeting_overall_items / meeting_part_items / meeting_action_items 테이블 정의 추가
├── routes/meetings.js         # 회의록 + 섹션 항목 CRUD 라우트 (신규)
└── index.js                   # app.use('/api/meetings', ...) 등록

client/src/
├── api/meetings.js            # fetchMeetings, createMeeting, deleteMeeting, fetchMeetingDetail,
│                               #   add/update/deleteOverallItem, add/update/deletePartItem,
│                               #   add/update/deleteActionItem (신규)
├── hooks/
│   └── useMeetings.js         # 목록/상세 상태 로드 + 위 액션 래핑 (신규)
└── components/MeetingMinutes/
    ├── MeetingMinutes.jsx     # 컨테이너: 목록 ↔ 상세 전환 (신규)
    ├── MeetingList.jsx        # 회의록 목록 + DateNavigator 기반 생성 폼 (신규)
    ├── MeetingDetail.jsx      # 상세 컨테이너: 3개 섹션 렌더 (신규)
    ├── OverallSection.jsx     # "전체" 섹션 리스트 + 인라인 추가/수정 폼 (신규)
    ├── PartSection.jsx        # "파트별" 섹션 리스트 + 인라인 추가/수정 폼 (신규)
    └── ActionItemSection.jsx  # "액션아이템" 섹션 리스트 + 인라인 추가/수정 폼 (신규)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [ ] 별도 `docs/01-plan/conventions.md` 없음 — 기존 코드 스타일(컴포넌트/훅/라우트 1:1 대응, `useXxx` 훅 + `api/xxx.js` 래퍼 패턴)을 컨벤션으로 간주하고 따른다

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| API 응답 형태 | 목록 API는 배열, 단건은 객체 (기존 tasks/schedules) | `GET /api/meetings/:id`는 회의록 + 3개 섹션 배열을 포함한 통합 객체 반환 — Design 문서에 명시 | High |
| 인라인 수정 폼 | 최근 커밋에 요구사항/보상/하위목표 인라인 수정 폼 도입됨 | 3개 섹션 모두 동일한 인라인 수정 UX(펼치기 → 필드 수정 → 저장/취소) 적용 | High |
| 삭제 확인 UX | 기존 커스텀 confirm 다이얼로그 패턴 존재 | 회의록 삭제에 동일 컴포넌트 재사용 여부를 Design에서 확인 | Medium |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`meeting-minutes.design.md`) — API 상세 스펙, 액션아이템 상태 값 집합 확정, 컴포넌트 props/상태 구조
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do meeting-minutes`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-01 | Initial draft | Mincoln Cho |
| 0.2 | 2026-09-01 | 액션아이템 AI 자동생성(FR-12/13) 범위 추가, 관련 리스크/영향도 반영 | Mincoln Cho |
