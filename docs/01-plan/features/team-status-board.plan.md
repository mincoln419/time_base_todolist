---
template: plan
version: 1.3
---

# team-status-board Planning Document

> **Summary**: 팀원(인원)을 상단 로스터에서 하나씩 추가하고, 하단의 업무/프로젝트별 레일(rail)로 드래그해 배치해서, 누가 어떤 업무를 맡고 있고 현재 어디에 투입되어 있는지 한눈에 파악하는 새 탭
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-28
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 팀원들이 여러 업무에 걸쳐 있거나 특정 업무를 주로 맡는 상황을, 지금은 한눈에 볼 수 있는 화면이 없다 |
| **Solution** | 상단에 "업무목록"과 같은 방식으로 인원을 하나씩 추가하고, 하단에 업무/프로젝트 단위 레일을 두어 인원 카드를 드래그로 배치·이동시키는 새 탭을 추가한다. 카드에는 그 사람이 맡은 업무를 태그로 여러 개 붙이고 그중 주요 업무를 표시한다 |
| **Function/UX Effect** | 전쟁 지도가 아니라 "레일에 인원을 놓는" 단순한 형태로, 드래그 한 번으로 배치 현황이 즉시 갱신되고 새로고침해도 유지된다 |
| **Core Value** | 흩어져 있는 "누가 지금 뭘 하고 있나"를 하나의 보드에서 실시간으로 파악할 수 있게 한다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 팀원별 업무 배치/진행 상황을 파악할 화면이 없어 매번 별도로 확인해야 함 |
| **WHO** | 이 앱을 쓰는 사용자 — 팀원들의 업무 배치를 관리하는 사람(매니저/리드) |
| **RISK** | "인원 카드 1개 = 위치 1개" 구조라 다중 업무 배치를 태그로만 표현 — 물리적 다중 배치처럼 보이진 않음 |
| **SUCCESS** | +버튼으로 인원 추가 → 레일로 드래그 배치 → 레일 간 이동/로스터 복귀 → 새로고침 후에도 유지 |
| **SCOPE** | (1) 3개 신규 테이블(rails/members/member_tasks) (2) `/api/warroom` REST API (3) 상단 로스터 + 하단 레일 보드 UI (4) 카드 내 업무 태그 CRUD (5) 새 탭 등록 |

---

## 1. Overview

### 1.1 Purpose

팀원을 "인원 카드"로 등록하고, 업무/프로젝트 단위의 "레일"에 드래그로 배치해, 각 인원이 현재 어느 업무에 투입되어 있고 어떤 업무들을 맡고 있는지 한 화면에서 파악하는 보드 기능을 추가한다.

### 1.2 Background

현재 일정관리(schedule), 포커스 맵, 고객사 티켓, 장기목표 등은 모두 "1인 사용자"가 자신의 할일/목표를 관리하는 화면이다. 이번 기능은 그와 별개로, 팀원 여러 명의 현재 업무 배치 상태를 관리자 시점에서 보는 새로운 성격의 화면이다. 사용자와의 대화에서 다음을 확정했다:

- 드래그 가능한 단위는 **인원 카드 자체**다. 한 사람은 카드 1개로 표현되고, 카드를 레일 위에서 옮겨 그 사람의 현재 위치(주로 투입된 업무)를 나타낸다.
- 하단 레일은 **업무/프로젝트 단위**다 (진행 상태 단계가 아니라 "어느 전장/업무에 배치되었는가"를 의미). "전쟁 지도"가 아니라 "레일에 인원을 추가하는" 단순한 형태를 원한다.
- 인원은 **여러 업무에 매핑**될 수 있으므로, 카드 안에 업무명을 여러 개 태그로 붙이고 그중 하나를 주요 업무로 표시한다. 다만 카드의 레일 위치(물리적 배치)는 한 번에 하나다.
- 보드는 **날짜와 무관한 단일 지속 보드**다. 기존 일정관리처럼 날짜별로 나뉘지 않고, 마지막 배치 상태가 계속 유지된다.
- 인원 추가는 "업무목록"(TaskBacklog)과 같은 느낌 — +버튼/입력창으로 이름을 입력하면 목록에 하나씩 늘어난다.
- 레일도 추가할 수 있는 구조여야 한다 (하단에 +로 새 레일 생성).

### 1.3 Related Documents

- 참고 UI 패턴: `client/src/components/TaskBacklog/TaskBacklog.jsx` (인원 추가 입력창), `client/src/App.jsx`의 `DndContext`/`handleDragEnd` (드래그 배치 패턴)
- 참고 삭제 확인 패턴: 최근 커밋 "Refactor worry complete/restore actions with inline buttons and custom confirm dialog"

---

## 2. Scope

### 2.1 In Scope

- [ ] `warroom_rails` / `warroom_members` / `warroom_member_tasks` 3개 테이블 추가
- [ ] `GET/POST/PUT/DELETE /api/warroom/...` REST API (레일 CRUD, 인원 CRUD, 인원-업무태그 CRUD, 인원 배치 이동)
- [ ] 상단 "미배치 인원" 로스터 영역 — +버튼/입력창으로 인원 추가, 카드가 하나씩 늘어남
- [ ] 하단 레일 목록 — 각 레일은 이름 + 배치된 인원 카드들의 드롭 영역
- [ ] 레일 목록 끝에 "+레일 추가" 입력창
- [ ] 인원 카드를 로스터 ↔ 레일 ↔ 다른 레일 사이로 드래그해 배치를 바꾸는 기능
- [ ] 인원 카드 내부에 업무 태그 여러 개 추가/삭제, 주요 업무 지정
- [ ] 레일 이름 수정 / 레일 삭제(배치된 인원은 로스터로 복귀, 삭제되지 않음)
- [ ] 인원 카드 삭제(확인 다이얼로그 포함, 업무 태그도 함께 삭제)
- [ ] 상단 네비게이션에 새 탭 등록

### 2.2 Out of Scope

- 한 인원이 여러 레일에 "물리적으로" 동시에 카드로 나타나는 기능 (업무 태그로만 다중 매핑을 표현)
- 레일/카드에 대한 진행률(%), 기한, 알림 등 부가 지표
- 날짜별 스냅샷/이력 관리 (현재 상태만 유지)
- 레일 순서 외의 인원 카드 세부 정렬(우선순위 정렬 등)
- 다중 사용자 동시 편집(실시간 동기화, 락 처리)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `warroom_rails`(id, name, position), `warroom_members`(id, name, rail_id nullable, position), `warroom_member_tasks`(id, member_id, title, is_primary, position) 테이블을 정의한다 | High | Pending |
| FR-02 | `GET /api/warroom`는 전체 보드(모든 레일, 모든 인원과 그 인원의 업무 태그)를 한 번에 반환한다 | High | Pending |
| FR-03 | 상단 로스터 영역에 인원 추가 입력창(+버튼)을 제공하며, 이름 입력 후 추가하면 `rail_id = NULL` 상태의 새 인원 카드가 로스터에 나타난다 | High | Pending |
| FR-04 | 하단에 레일들을 표시하고, 각 레일은 이름과 그 레일에 배치된(`rail_id` 일치) 인원 카드 목록을 보여준다 | High | Pending |
| FR-05 | 레일 목록 끝에 "+ 레일 추가" 입력창을 제공해 새 레일을 생성한다 | High | Pending |
| FR-06 | 인원 카드를 레일 위로 드래그하면 `PUT /api/warroom/members/:id`로 `rail_id`가 갱신되고 그 레일 소속으로 다시 렌더링된다 | High | Pending |
| FR-07 | 레일에 배치된 카드를 다른 레일로 드래그하면 `rail_id`가 바뀐다 | High | Pending |
| FR-08 | 배치된 카드를 상단 로스터 영역으로 드래그하면 `rail_id = NULL`로 갱신되어 미배치 상태로 돌아간다 | High | Pending |
| FR-09 | 인원 카드에서 업무 태그를 추가할 수 있다 (`POST /api/warroom/members/:id/tasks`) | High | Pending |
| FR-10 | 업무 태그 중 하나를 주요 업무로 지정할 수 있다 (`PUT /api/warroom/member-tasks/:id` — 지정 시 같은 인원의 다른 태그는 자동으로 주요 해제) | Medium | Pending |
| FR-11 | 업무 태그를 개별 삭제할 수 있다 (`DELETE /api/warroom/member-tasks/:id`) | Medium | Pending |
| FR-12 | 레일 이름을 수정할 수 있다 (`PUT /api/warroom/rails/:id`) | Medium | Pending |
| FR-13 | 레일을 삭제할 수 있다 (`DELETE /api/warroom/rails/:id`) — 삭제 시 그 레일의 인원은 `rail_id = NULL`로 로스터에 복귀하며, 실행 전 커스텀 확인 다이얼로그를 띄운다 | Medium | Pending |
| FR-14 | 인원 카드를 삭제할 수 있다 (`DELETE /api/warroom/members/:id`, 업무 태그는 CASCADE 삭제) — 실행 전 커스텀 확인 다이얼로그를 띄운다 | Medium | Pending |
| FR-15 | 상단 네비게이션 탭 목록에 새 탭("업무 배치 보드")을 추가해 이 화면으로 이동할 수 있다 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 지속성 | 보드는 날짜/세션과 무관한 단일 상태 — 새로고침·탭 재방문 후에도 마지막 배치 상태가 그대로 유지 | 수동 테스트 |
| 격리성 | 새 컴포넌트는 자체 `DndContext`를 사용해 기존 일정관리 탭(App.jsx)의 `DndContext`/`handleDragEnd` 로직을 건드리지 않는다 | 코드 리뷰 |
| 회귀 방지 | 기존 탭(일정관리/포커스맵/고객사/캘린더/고민목록/장기목표/설정)의 동작에 영향 없음 | 수동 테스트 |
| 규모 가정 | 로컬 단일 사용자 SQLite 환경 — 팀원 수십 명, 레일 수십 개 수준을 가정, 페이지네이션/가상화 불필요 | 해당 없음 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] +버튼으로 인원을 추가하면 상단 로스터에 즉시 나타난다
- [ ] 로스터의 인원 카드를 레일로 드래그하면 그 레일 소속으로 이동해 표시된다
- [ ] 레일 간 드래그로 인원의 소속 레일을 바꿀 수 있다
- [ ] 배치된 카드를 로스터로 다시 드래그하면 미배치 상태로 돌아간다
- [ ] "+레일 추가"로 새 레일을 만들 수 있고, 레일 이름 수정·삭제가 가능하다
- [ ] 레일 삭제 시 그 레일의 인원은 삭제되지 않고 로스터로 복귀한다
- [ ] 인원 카드에 업무 태그를 여러 개 추가·삭제하고 주요 업무를 지정할 수 있다
- [ ] 인원 카드 삭제 시 확인 다이얼로그가 뜨고, 확인 후 업무 태그도 함께 삭제된다
- [ ] 브라우저를 새로고침해도 배치 상태(레일 소속, 태그)가 그대로 유지된다
- [ ] 기존 다른 탭들의 동작에 회귀 없음

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(인원 3명 추가 → 레일 2개 생성 → 배치/이동/복귀 → 태그 추가·주요 지정 → 새로고침 확인 → 레일 삭제 → 인원 삭제) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 레일이 많아지면 세로로 길어지거나 카드가 넘쳐 레이아웃이 복잡해짐 | Medium | Medium | 레일은 세로로 쌓는 리스트형 레이아웃, 레일 내부 카드는 가로 `flex-wrap`으로 배치. 필요 시 Design 단계에서 스크롤 컨테이너 확정 |
| "인원 카드 1개 = 위치 1개" 구조라 한 사람이 여러 업무에 동시 투입된 상태를 레일 위치만으로는 표현 못함 | Low | Medium | Out of Scope로 명시하고 업무 태그로 보완. 필요성이 커지면 후속 PDCA 사이클에서 "보조 배치" 기능 별도 기획 |
| 레일/인원 삭제가 실수로 실행될 위험 | Medium | Low | 기존에 확립된 커스텀 confirm 다이얼로그 패턴을 그대로 재사용 |
| 새 `DndContext`가 기존 스케줄 탭의 DnD 센서/이벤트와 충돌 | Low | Low | 새 컴포넌트 내부에 독립된 `DndContext`를 두고, 탭이 전환될 때만 마운트되므로 두 컨텍스트가 동시에 활성화되지 않음 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `warroom_rails` / `warroom_members` / `warroom_member_tasks` | DB Schema | 신규 테이블 3개 추가 (breaking 없음, 기존 테이블 무변경) |
| `/api/warroom/*` | API | 신규 라우트 추가 (기존 라우트 무변경) |
| `client/src/App.jsx` | Component | `TABS` 배열에 항목 1개 추가, 탭 렌더 분기 1개 추가 (기존 탭 로직 무변경) |
| `client/src/components/WarRoomBoard/*` (신규) | Component | 로스터 + 레일 보드 UI 신규 작성 |
| `client/src/hooks/useWarRoom.js` (신규) | Hook | 보드 상태 조회/조작 |
| `client/src/api/warroom.js` (신규) | API Client | fetch 래퍼 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `App.jsx`의 `TABS`/`DndContext` | READ/WRITE | 기존 일정관리 탭 렌더링 | None — 새 탭은 별도 분기 및 자체 `DndContext`로 격리, 기존 스케줄 DnD 로직 미변경 |
| 기존 confirm 다이얼로그 컴포넌트 (있다면 재사용) | READ | 레일/인원 삭제 확인 | None — 기존 패턴을 그대로 호출만 추가 |

### 6.3 Verification

- [ ] 신규 테이블/라우트/컴포넌트가 기존 코드와 이름이 겹치지 않는지 확인 (`warroom` 접두사로 통일)
- [ ] `App.jsx` 외 기존 파일은 수정하지 않았는지 확인
- [ ] 새 탭 진입/이탈 시 다른 탭의 상태(스케줄, 포커스맵 등)에 부작용이 없는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 bkit의 Starter/Dynamic/Enterprise(Next.js/bkend.ai 프리셋) 분류 대상이 아닌, React(Vite) + Express + SQLite(`node:sqlite`) 커스텀 스택이다. 아래 표는 실제 스택 기준으로 작성한다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| DnD | `@dnd-kit/core` | 기존과 동일 라이브러리, 새 컴포넌트 안에서 독립된 `DndContext`로 사용 |
| 상태 관리 | 로컬 React state + custom hook (`useWarRoom`) | 기존 `useTasks`/`useLongGoals` 패턴 재사용 |
| API 클라이언트 | 순수 `fetch` 래퍼 (`api/warroom.js`) | 기존 컨벤션 재사용 |
| 백엔드 | Express + `node:sqlite`(`DatabaseSync`) 동기 호출 | 기존과 동일 |
| DB | SQLite 파일 (`data/todo.db`) | 기존과 동일, 신규 테이블만 추가 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 드래그 단위 | (A) 인원 카드 자체 (위치 1개) / (B) 인원+업무 조합 카드 (다중 위치) | **(A)** | 사용자가 명시적으로 "카드 자체를 이동"을 선택. 다중 매핑은 카드 내부 업무 태그로 표현해 구조를 단순하게 유지 |
| 레일의 의미 | (A) 진행 상태 단계 / (B) 업무·프로젝트 단위 | **(B)** | 사용자가 "전장에 인원을 배치하는 형태"를 명시적으로 선택. 레일 = 어느 업무/프로젝트에 배치되었는가 |
| 보드 범위 | (A) 날짜별 보드 / (B) 날짜 무관 단일 지속 보드 | **(B)** | 사용자가 "지속 보드"를 선택. `schedules`처럼 `date` 컬럼을 두지 않고 현재 상태만 유지 |
| 업무 태그 저장 방식 | (A) 인원 row에 JSON 배열로 저장(포커스 맵 방식) / (B) 별도 `warroom_member_tasks` 테이블 | **(B)** | 태그 개별 추가/삭제/주요 지정이 빈번한 조작이므로, 기존 `long_goal_subgoals` 같은 자식 테이블 패턴이 더 적합 (JSON 부분 갱신보다 단순) |
| 레일 삭제 시 인원 처리 | (A) 인원도 함께 삭제 / (B) 인원은 유지, 로스터로 복귀 | **(B)** | 인원 데이터 유실을 막기 위해 `ON DELETE SET NULL`로 안전하게 처리 (기존 프로젝트의 "실수 방지" 성향과 일치) |
| DnD 컨텍스트 범위 | (A) `App.jsx`의 기존 `DndContext`를 확장 / (B) 새 컴포넌트 안에 독립된 `DndContext` | **(B)** | 기존 스케줄 탭의 `handleDragEnd` 분기 로직을 건드리지 않고 완전히 격리 — Surgical Changes 원칙 |

### 7.3 폴더 구조 변화 (예상)

```
server/
├── db/schema.sql              # warroom_rails / warroom_members / warroom_member_tasks 테이블 정의 추가
├── routes/warroom.js          # 레일/인원/업무태그 CRUD 라우트 (신규)
└── index.js                   # app.use('/api/warroom', ...) 등록

client/src/
├── api/warroom.js             # fetchBoard, createRail, renameRail, deleteRail,
│                               #   createMember, moveMember, deleteMember,
│                               #   addMemberTask, setPrimaryTask, deleteMemberTask (신규)
├── hooks/
│   └── useWarRoom.js          # 보드 상태 로드 + 위 액션 래핑 (신규)
└── components/WarRoomBoard/
    ├── WarRoomBoard.jsx       # 컨테이너: DndContext + 로스터 + 레일 목록 (신규)
    ├── MemberRoster.jsx       # 상단 미배치 인원 목록 + 인원 추가 입력창 (신규)
    ├── MemberCard.jsx         # 드래그 가능한 인원 카드 + 업무 태그 CRUD (신규)
    └── Rail.jsx               # 개별 레일 행(드롭 영역) + 이름 수정/삭제 (신규)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [ ] 별도 `docs/01-plan/conventions.md` 없음 — 기존 코드 스타일(컴포넌트/훅/라우트 1:1 대응, `useXxx` 훅 + `api/xxx.js` 래퍼 패턴)을 컨벤션으로 간주하고 따른다
- [ ] ESLint/Prettier/TS 설정 없음 — 신규 도입하지 않음 (프로젝트 범위 밖)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| API 응답 형태 | 목록 API는 배열, 단건은 객체 (기존 tasks/schedules) | `/api/warroom`(GET)만 예외적으로 `{ rails, members }` 형태의 통합 객체 반환 — Design 문서에 명시 | High |
| 에러 메시지 | 한국어 메시지, `{ error: '...' }` 형태 (기존) | 신규 라우트도 동일 포맷 유지 (이름 공백 시 400 등) | High |
| 삭제 확인 UX | 최근 커밋에 커스텀 confirm 다이얼로그 패턴 도입됨 | 레일/인원 삭제에도 동일 컴포넌트/패턴 재사용 여부를 Design에서 확인 | Medium |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`team-status-board.design.md`) — API 상세 스펙(요청/응답 예시), 컴포넌트 props/상태 구조, 기존 confirm 다이얼로그 재사용 방식 확정
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do team-status-board`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-28 | Initial draft | Mincoln Cho |
