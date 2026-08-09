---
template: plan
version: 1.3
---

# customer-tickets Planning Document

> **Summary**: 고객사대응 별 티켓을 관리하는 새 탭 추가 — 좌측에 고객사 목록, 우측에 선택된 고객사의 티켓 목록(+ 버튼으로 추가, 토글로 등록 상태 표시)을 두고, 등록한 티켓은 일정관리 탭 할일 백로그에도 함께 나타난다
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-09
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 여러 고객사를 동시에 대응할 때, 어떤 고객사에 어떤 티켓(업무)이 남아있는지 관리할 화면이 없어 메모/메신저 등 앱 밖에 흩어진다 |
| **Solution** | 포커스 맵과 같은 좌(목록)·우(상세) 2단 레이아웃의 새 탭을 추가한다. 좌측에서 고객사를 추가/선택하고, 우측에서 "+" 버튼으로 해당 고객사의 티켓을 추가한다. 각 티켓은 토글 방식으로 등록 전/등록됨(취소선 + 회색) 상태를 표시하며, 추가된 티켓은 일정관리 탭의 할일 백로그에도 함께 반영된다 |
| **Function/UX Effect** | 고객사 전환 한 번으로 해당 건의 티켓을 빠르게 추가·확인하고, 처리(등록)된 티켓은 시각적으로 옅게 구분되며, 같은 항목을 일정관리 탭에서 다시 입력할 필요 없이 바로 시간표에 배치할 수 있다 |
| **Core Value** | 여러 고객사 대응 업무를 한 화면에서 트래킹하면서, 실행(일정 배치)까지 손실 없이 이어주는 경량 티켓 트래커를 제공한다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 고객사별 대응 이력/할일을 기록할 화면이 없어 앱 밖 도구에 흩어지고, 일정관리 탭과도 연결되지 않음 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 여러 고객사를 동시에 대응하는 사람 |
| **RISK** | 신규 테이블 2개(`customers`, `tickets`) 추가, `tasks` 테이블에 대한 신규 write 경로 추가(스키마 변경 없음) |
| **SUCCESS** | 좌측에서 고객사를 추가/선택하고, 우측에서 + 로 티켓을 추가하면 즉시 목록과 일정관리 할일 백로그에 반영되며, 토글로 등록 상태(취소선+회색)를 전환할 수 있음 |
| **SCOPE** | (1) `customers`/`tickets` 테이블 신설 (2) 서버 API (3) 신규 탭 + 좌측 고객사 목록 UI (4) 우측 티켓 목록 + 추가 + 토글 UI (5) 티켓 추가 시 `tasks` API 연동 |

---

## 1. Overview

### 1.1 Purpose

고객사대응 별 티켓을 관리하기 위한 새 탭을 추가한다. 포커스 맵 탭과 동일하게 좌측 목록 + 우측 상세 2단 레이아웃 패턴을 재사용한다.

### 1.2 Background

현재 앱은 "일정관리", "포커스 맵" 두 개의 탭만 있고, 고객사별로 들어오는 요청(티켓)을 추적할 화면이 없다. 사용자가 확정한 요구사항은 다음과 같다:

1. 기본 구조: 좌측에 목록(고객사) 추가
2. 좌측 목록에서 항목을 선택하면 우측 화면에 상세(해당 고객사의 티켓 목록)를 보여주고, "+" 버튼으로 티켓(대상 업무)을 추가
3. 각 티켓 항목은 **토글** 방식 — 최초에는 "등록 전" 상태이고, 토글하면 "등록됨" 상태로 바뀌며 **취소선 + 회색**으로 표시
4. 이 화면에서 입력한 티켓 항목은 **일정관리 탭의 할일 백로그(`tasks`)에도 함께 표시**되어야 함

### 1.3 Related Documents

- 참고 패턴(좌/우 2단 레이아웃, 목록형 API, `tasks` 재사용): `client/src/components/FocusMap/FocusMap.jsx`, `server/routes/focusmap.js`, `docs/01-plan/features/focusmap-goals.plan.md`
- 재사용 대상(수정 없이 호출만): `server/routes/tasks.js` (`POST /api/tasks`), `client/src/hooks/useTasks.js`

---

## 2. Scope

### 2.1 In Scope

- [ ] `customers` 테이블 신설 (`id`, `name`, `created_at`)
- [ ] `tickets` 테이블 신설 (`id`, `customer_id` FK, `title`, `registered`, `created_at`)
- [ ] 고객사 API: `GET /api/customers`, `POST /api/customers`, `DELETE /api/customers/:id`
- [ ] 티켓 API: `GET /api/customers/:id/tickets`, `POST /api/customers/:id/tickets`, `PATCH /api/tickets/:id/toggle`, `DELETE /api/tickets/:id`
- [ ] 새 탭("고객사 티켓") 추가 — `App.jsx`의 `TABS` 배열에 등록
- [ ] 좌측 고객사 목록 컴포넌트: 목록 표시, 이름 입력 후 추가, 클릭 시 선택 강조 + 우측 상세 로드, 삭제
- [ ] 우측 티켓 상세 컴포넌트: 선택된 고객사의 티켓 목록, "+" 버튼 → 제목 입력 → 추가
- [ ] 티켓 항목 토글: 클릭 시 등록 여부 반전. 등록 상태는 취소선 + 회색 텍스트로 표시
- [ ] 티켓 추가 시 동일 제목으로 기존 `POST /api/tasks`를 호출해 일정관리 탭 할일 백로그에도 추가
- [ ] 고객사 미선택 시 우측에 안내 문구(빈 상태) 표시

### 2.2 Out of Scope

- 티켓 상세 편집(설명/첨부/코멘트), 고객사 정보 수정(이름 변경, 담당자/연락처 등 부가 필드)
- 다단계 상태(진행중/보류 등) — 요구사항은 "등록 전 / 등록됨" 2단계 토글만
- 티켓 ↔ 할일(tasks) 간 양방향 동기화 (예: 할일 삭제/완료 시 티켓 쪽 상태 갱신, 티켓 삭제 시 이미 추가된 할일 자동 삭제) — 포커스 맵과 동일하게 단방향 전달만 지원
- 검색/필터/정렬, 페이지네이션, 고객사 간 티켓 일괄 이동

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `customers` 테이블은 `id`(PK), `name`(NOT NULL), `created_at`을 저장한다 | High | Pending |
| FR-02 | `tickets` 테이블은 `id`(PK), `customer_id`(FK → customers.id, ON DELETE CASCADE), `title`(NOT NULL), `registered`(0/1, 기본 0), `created_at`을 저장한다 | High | Pending |
| FR-03 | `GET /api/customers`는 고객사 목록을 반환한다 | High | Pending |
| FR-04 | `POST /api/customers`는 이름으로 고객사를 추가한다 (공백/빈 값이면 400) | High | Pending |
| FR-05 | `DELETE /api/customers/:id`는 고객사를 삭제한다 (연결된 티켓은 CASCADE 삭제) | Medium | Pending |
| FR-06 | `GET /api/customers/:id/tickets`는 해당 고객사의 티켓 목록을 반환한다 | High | Pending |
| FR-07 | `POST /api/customers/:id/tickets`는 제목으로 티켓을 추가한다 (공백이면 400, `registered` 기본값 0) | High | Pending |
| FR-08 | `PATCH /api/tickets/:id/toggle`은 해당 티켓의 `registered` 값을 반전(0↔1)하고 갱신된 티켓을 반환한다 | High | Pending |
| FR-09 | `DELETE /api/tickets/:id`는 티켓을 삭제한다 | Medium | Pending |
| FR-10 | 새 탭을 클릭하면 좌측에 고객사 목록, 우측에 선택된 고객사의 티켓 목록이 표시된다 | High | Pending |
| FR-11 | 좌측에서 고객사를 추가하면 목록에 즉시 나타나고, 목록이 비어있으면 안내 문구를 표시한다 | Medium | Pending |
| FR-12 | 좌측에서 고객사를 클릭하면 우측 목록이 해당 고객사의 티켓으로 갱신되고, 선택된 항목은 강조 표시된다 | High | Pending |
| FR-13 | 우측 "+" 버튼을 누르면 제목 입력 UI가 나타나고, 입력 후 추가하면 티켓 목록에 즉시 반영된다 | High | Pending |
| FR-14 | 각 티켓 항목을 토글하면 등록 상태가 반전되며, 등록된 티켓은 취소선 + 회색 텍스트로 표시된다 | High | Pending |
| FR-15 | 고객사를 아직 선택하지 않은 경우 우측에 "고객사를 선택해주세요" 안내를 표시한다 | Low | Pending |
| FR-16 | 티켓 추가(FR-13) 시, 동일 제목으로 기존 `POST /api/tasks`를 호출하여 일정관리 탭 할일 백로그에도 항목이 추가된다 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 일관성 | 할일 백로그 연동은 기존 `tasks` 테이블/`POST /api/tasks` 검증 로직을 그대로 재사용 (별도 검증 로직 신설 금지) | 코드 리뷰 |
| 데이터 무결성 | 고객사명/티켓 제목이 빈 문자열이거나 공백뿐이면 추가되지 않음 | 수동 테스트 |
| 회귀 방지 | 기존 일정관리/포커스 맵 탭의 동작에 영향 없음 | 수동 테스트 |
| 규모 가정 | 로컬 단일 사용자 SQLite 환경 — 고객사/티켓 수 수십~수백 개 수준을 가정, 페이지네이션/캐싱 불필요 | 해당 없음 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 고객사를 2개 이상 추가하고 좌측 목록에서 전환할 수 있다
- [ ] 선택된 고객사의 우측 화면에서 "+"로 티켓을 추가할 수 있다
- [ ] 추가한 티켓이 즉시 목록에 나타나고, 동시에 일정관리 탭 할일 백로그에도 나타난다
- [ ] 티켓을 토글하면 취소선 + 회색으로 "등록됨" 상태가 표시되고, 다시 토글하면 원상태로 돌아간다
- [ ] 고객사를 삭제하면 해당 고객사의 티켓도 함께 사라진다
- [ ] 기존 일정관리/포커스 맵 탭 흐름에 회귀 없음

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(고객사 2개 추가 → 전환 → 티켓 추가 → 토글 → 일정관리 탭에서 확인) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 고객사 삭제 시 CASCADE로 연결된 티켓이 한 번에 전부 사라짐 | Medium | Medium | Design 단계에서 삭제 전 확인(confirm) UX를 명시 |
| "취소선 + 회색"이 완료/처리 의미로 보일 수 있어 실제 티켓 처리 여부와 혼동 | Low | Medium | 라벨/툴팁으로 "등록됨" 의미를 명확히 표기 (Design에서 문구 확정) |
| 티켓 제목이 일정관리 백로그에 그대로 들어가면 어느 고객사의 티켓인지 구분이 안 됨 | Medium | High | `POST /api/tasks` 호출 시 제목에 고객사명을 prefix로 포함(예: `[고객사명] 티켓제목`) — Design에서 최종 포맷 확정 |
| 할일 백로그 쪽에서 해당 항목을 삭제/완료해도 티켓 쪽 상태가 갱신되지 않아 불일치 | Low | Medium | 양방향 동기화는 Out of Scope로 명시. Design 문서에 알려진 제약으로 기록 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `customers` 테이블 | DB Schema | 신규 |
| `tickets` 테이블 | DB Schema | 신규 (customers FK) |
| `/api/customers`, `/api/customers/:id/tickets`, `/api/tickets/:id` | API | 신규 라우트 |
| `App.jsx` | Component | `TABS` 배열에 항목 추가 + 신규 탭 조건부 렌더링 블록 추가 (기존 `schedule`/`focusmap` 블록 변경 없음) |
| `client/src/components/CustomerTickets/` | Component | 신규 디렉토리 (좌측 목록 + 우측 상세) |
| `tasks` 테이블 / `POST /api/tasks` | API (기존, write-only 재사용) | 스키마·로직 변경 없음. 신규 탭에서 새 호출 지점만 추가됨 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `tasks` | CREATE | 신규 `CustomerTickets` 컴포넌트 → `POST /api/tasks` | None — 기존 경로/검증 로직 변경 없이 호출만 추가 |
| `tasks` | READ | `App.jsx` → `useTasks()` → `GET /api/tasks` | None — 신규 탭에서 추가한 항목도 동일하게 조회됨 (자연스럽게 반영) |
| `focus_map`, `schedules` | - | - | 영향 없음 (독립 도메인) |

### 6.3 Verification

- [ ] 신규 코드(테이블, 라우트, 훅, 컴포넌트)가 기존 `tasks`/`schedules`/`focus_map` 코드를 건드리지 않았는지 확인
- [ ] `tasks` 관련 기존 코드(`TaskBacklog`, `useTasks`, `tasks.js`)는 수정 없이 그대로 재사용했는지 확인
- [ ] 티켓 제목의 일정관리 백로그 prefix 포맷이 Design 단계에서 확정되었는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 bkit의 Starter/Dynamic/Enterprise(Next.js/bkend.ai 프리셋) 분류 대상이 아닌, React(Vite) + Express + SQLite(`node:sqlite`) 커스텀 스택이다. 아래 표는 실제 스택 기준으로 작성한다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 상태 관리 | 로컬 React state + custom hook | 기존 `useTasks`/`useFocusMap` 패턴 재사용 |
| API 클라이언트 | 순수 `fetch` 래퍼 (`api/*.js`) | 기존 컨벤션 재사용 |
| 백엔드 | Express + `node:sqlite`(`DatabaseSync`) 동기 호출 | 기존과 동일 (`server/db/database.js`) |
| DB | SQLite 파일 (`data/todo.db`), `PRAGMA foreign_keys = ON` | 기존과 동일 — `customers`/`tickets` FK 제약이 실제로 적용됨 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 티켓 등록 상태 저장 방식 | (A) 별도 상태 enum(`open`/`registered` 등 TEXT) / (B) `registered` INTEGER(0/1) 불리언 | **(B)** | 요구사항이 "등록 전 ↔ 등록됨" 2단계 토글뿐이므로 `schedules.status`식 다단계 enum 대신 단순 불리언으로 충분 |
| 티켓 API 구조 | (A) `/api/tickets`에 `customer_id` 쿼리 파라미터 / (B) `/api/customers/:id/tickets` 중첩 라우트(생성/조회), 토글·삭제는 `/api/tickets/:id` | **(B)** | 고객사에 종속된 리소스임을 URL로 명확히 하고, 단건 조작(토글/삭제)은 `tickets` 리소스로 분리해 REST 관례를 따름 |
| 일정관리 백로그 연동 시점 | (A) 티켓 토글(등록) 시점에 `tasks` 추가 / (B) 티켓 생성(+ 버튼) 시점에 즉시 `tasks` 추가 | **(B)** | 사용자가 "이 화면에서 입력한 항목도 표시되도록"이라고 명시 — 생성 즉시 반영이 요구사항과 직접 일치하며 포커스 맵의 "선택 후 변환" 방식보다 단순 |
| 일정관리 백로그 제목 포맷 | (A) 티켓 제목 그대로 전달 / (B) `[고객사명] 티켓제목` 형태로 prefix | **(B)** | 백로그는 고객사 구분 없는 평면 목록이므로, prefix 없이는 어느 고객사 건인지 알 수 없음 (5장 리스크 참고) |
| 고객사/티켓 삭제 시 연쇄 처리 | (A) 애플리케이션 레벨에서 티켓을 먼저 삭제 후 고객사 삭제 / (B) `ON DELETE CASCADE` FK 제약으로 DB가 처리 | **(B)** | 기존 `schedules`/`tasks` 관계처럼 DB 제약으로 일관성 보장, 별도 트랜잭션 코드 불필요 |

### 7.3 폴더 구조 변화 (예상)

```
server/
├── db/schema.sql              # customers, tickets 테이블 추가
├── routes/
│   ├── customers.js            # GET/POST /, DELETE /:id, GET/POST /:id/tickets
│   └── tickets.js               # PATCH /:id/toggle, DELETE /:id
client/src/
├── api/
│   ├── customers.js             # listCustomers, addCustomer, deleteCustomer, listTickets, addTicket
│   └── tickets.js                # toggleTicket, deleteTicket
├── hooks/
│   └── useCustomerTickets.js    # 고객사 목록 + 선택된 고객사의 티켓 상태 관리 (신규)
└── components/CustomerTickets/
    ├── CustomerTickets.jsx       # 좌(고객사 목록) + 우(티켓 상세) 레이아웃 컨테이너
    ├── CustomerList.jsx          # 좌측 고객사 목록 (신규)
    └── TicketPanel.jsx           # 우측 티켓 목록 + "+" 추가 + 토글 (신규)
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
| API 응답 형태 | 신규 도메인 | 목록 API는 배열, 단건 API는 객체 — 기존 `tasks`/`schedules`와 동일한 형태로 통일 | High |
| 에러 메시지 | 한국어 메시지, `{ error: '...' }` 형태 (기존) | 신규 라우트도 동일 포맷 유지 | High |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`customer-tickets.design.md`) — 위 Architecture Decisions를 바탕으로 API 상세 스펙, 컴포넌트 상세 구조, 백로그 제목 prefix 포맷, 삭제 확인 UX 확정
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do customer-tickets`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | Initial draft | Mincoln Cho |
