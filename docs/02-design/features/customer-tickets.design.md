---
template: design
version: 1.3
---

# customer-tickets Design Document

> **Summary**: 고객사대응 별 티켓을 관리하는 새 탭의 설계 — 좌(고객사 목록)·우(티켓 상세) 2단 레이아웃, 티켓 등록 토글(취소선+회색), 티켓 생성 시 일정관리 할일 백로그 동시 반영
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-09
> **Status**: Draft
> **Planning Doc**: [customer-tickets.plan.md](../../01-plan/features/customer-tickets.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline(schema.md/conventions.md 등)을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 고객사별 대응 이력/할일을 기록할 화면이 없어 앱 밖 도구에 흩어지고, 일정관리 탭과도 연결되지 않음 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 여러 고객사를 동시에 대응하는 사람 |
| **RISK** | 신규 테이블 2개(`customers`, `tickets`) 추가, `tasks` 테이블에 대한 신규 write 경로 추가(스키마 변경 없음) |
| **SUCCESS** | 좌측에서 고객사를 추가/선택하고, 우측에서 + 로 티켓을 추가하면 즉시 목록과 일정관리 할일 백로그에 반영되며, 토글로 등록 상태(취소선+회색)를 전환할 수 있음 |
| **SCOPE** | (1) `customers`/`tickets` 테이블 신설 (2) 서버 API (3) 신규 탭 + 좌측 고객사 목록 UI (4) 우측 티켓 목록 + 추가 + 토글 UI (5) 티켓 추가 시 `tasks` API 연동 |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 1. Overview

### 1.1 Design Goals

- `customers`/`tickets` 2단 리소스를 `tasks`/`schedules`와 동일한 컨벤션(리소스당 API 1파일 + 라우트 1파일)으로 구현한다.
- 포커스 맵과 동일한 좌(목록) · 우(상세) 레이아웃 패턴을 재사용한다.
- 티켓 생성 시점에 기존 `useTasks().addTask()`를 그대로 호출해 일정관리 백로그에 즉시 반영한다 (새 API 신설 없음).

### 1.2 Design Principles

- **컨벤션 재사용**: `tasks.js`/`schedules.js`/`focusmap.js`와 동일하게 `{ error: string }` 에러 포맷, `db.prepare().run()` 파라미터 바인딩을 그대로 따른다.
- **단순함 우선**: 인증, 락, 페이지네이션, 실시간 동기화 없음. 등록 상태는 다단계 enum이 아닌 `registered`(0/1) 불리언 하나로 표현한다.
- **느슨한 결합 유지**: 포커스 맵→`tasks` 연동과 동일하게, 티켓→`tasks`는 외래키 없이 생성 시점에만 한 방향으로 연결한다 (Plan §5 Risk에서 이미 Out of Scope로 확정).

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Pragmatic | Option C: Full Store |
|----------|:-:|:-:|:-:|
| **Approach** | `CustomerTickets.jsx` 하나에 고객사+티켓 상태/API 호출 전부 집어넣음 | 목록(`useCustomers`)·상세(`useTickets`) 훅 분리 + 컨테이너 1개 + 표시 컴포넌트 2개 | 전역 상태 관리 라이브러리(Zustand 등) 도입 |
| **New Files** | 3 (component, api, route) | 7 | 9+ |
| **Modified Files** | 2 (App.jsx, schema.sql) | 2 | 3 |
| **Complexity** | Low | Medium | High |
| **Maintainability** | Low (고객사/티켓 갱신 시점이 섞임) | High | High (과설계) |
| **Effort** | Low | Medium | High |
| **Risk** | Medium (커질수록 리팩터 필요) | Low | Low (규모 대비 과함) |
| **Recommendation** | Quick wins | **Default choice** | 로컬 단일 사용자 앱에는 불필요 |

**Selected**: **Option B — Pragmatic**
**Rationale**: 이미 이 프로젝트에는 `useFocusMapList`(목록)·`useFocusMap`(활성 세션 1건)로 갱신 시점이 다른 두 훅을 분리한 선례가 있다. 고객사 목록(추가/삭제 시에만 재조회)과 선택된 고객사의 티켓(고객사 전환·추가·토글·삭제 시 재조회)도 동일하게 생명주기가 다르므로 `useCustomers`/`useTickets`로 분리하는 것이 자연스럽다. 전역 스토어(Option C)는 이 앱 규모에 맞지 않는 과설계다.

> 아래 상세 설계는 Option B를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌──────────────────┐      ┌───────────────────────────────┐      ┌───────────┐
│ CustomerTickets   │─────▶│ Express /api/customers          │─────▶│ SQLite    │
│ 탭 (SPA)          │◀─────│ /api/tickets  (GET/POST/PATCH/DEL)│◀─────│ customers │
└─────┬─────────────┘      └───────────────────────────────┘      │ tickets   │
      │                                                             └───────────┘
      └────▶ App.jsx의 기존 useTasks().addTask() ────▶ POST /api/tasks (변경 없음) ────▶ tasks 테이블
```

### 2.2 Data Flow

```
탭 진입 → useCustomers로 좌측 고객사 목록 로드
  → 고객사 클릭 시: selectedCustomerId 갱신 → useTickets(selectedCustomerId)가 GET /api/customers/:id/tickets 재조회
  → 좌측 "+ 고객사 추가" → POST /api/customers → 목록 재조회
  → 좌측 고객사 삭제 → DELETE /api/customers/:id → 목록 재조회 (선택 중이었다면 selectedCustomerId=null)
  → 우측 "+" 클릭 → 제목 입력 → 확인
      → POST /api/customers/:id/tickets → 티켓 목록에 즉시 반영
      → 성공 시 App.jsx로부터 전달받은 addTask(`[${customer.name}] ${title}`) 호출 (기존 tasks 로직 재사용, 변경 없음)
  → 티켓 항목 클릭(토글) → PATCH /api/tickets/:id/toggle → 응답으로 받은 registered 값으로 해당 행만 갱신
  → 티켓 삭제 → DELETE /api/tickets/:id → 목록에서 제거
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `CustomerTickets.jsx` | `useCustomers`, `useTickets`, `addTask`(App.jsx로부터 props) | 좌우 레이아웃 조합, 선택된 고객사 id 상태 보유, 티켓 생성 시 할일 백로그 연동 |
| `CustomerList.jsx` | (props로만 데이터 수신) | 고객사 목록 표시/선택/추가/삭제 — 순수 표시 컴포넌트 |
| `TicketPanel.jsx` | (props로만 데이터 수신) | 선택된 고객사의 티켓 목록 표시, "+" 입력 UI, 토글/삭제 이벤트 위임 — 순수 표시 컴포넌트 |
| `useCustomers.js` | `api/customers.js` | 고객사 목록 조회·생성·삭제 |
| `useTickets.js` | `api/tickets.js` | 선택된 고객사(id)의 티켓 조회·생성·토글·삭제 |

---

## 3. Data Model

### 3.1 Entity Definition

```
Customer
{
  id:        number,   // AUTOINCREMENT PK
  name:      string,   // NOT NULL
  createdAt: string,   // datetime('now','localtime')
}

Ticket
{
  id:          number,       // AUTOINCREMENT PK
  customerId:  number,       // FK → customers.id, ON DELETE CASCADE
  title:       string,       // NOT NULL
  registered:  0 | 1,        // 기본 0 (등록 전) → 토글 시 1 (등록됨)
  desiredDate: string | null, // 희망 일자 (YYYY-MM-DD), 선택 입력, 생성 후에도 수정 가능 (v0.1.1 추가)
  createdAt:   string,
}
```

> **v0.1.1 변경**: `desired_date` 컬럼 추가 (nullable). 기존 로컬 DB는 `server/db/database.js`의 `PRAGMA table_info` 가드로 `ALTER TABLE tickets ADD COLUMN desired_date TEXT`를 1회 자동 실행해 기존 데이터를 보존한 채 마이그레이션한다. API는 실제 구현 컨벤션에 맞춰 `desired_date`(snake_case)로 주고받는다 (Gap Analysis §2에서 확인된 것과 동일하게, 이 문서의 다른 필드명도 실제로는 camelCase가 아닌 snake_case로 반환됨).

### 3.2 Entity Relationships

```
[customers] 1 ──── N [tickets]   (customer_id FK, ON DELETE CASCADE)
[tickets]   ── (참조/FK 없음, 느슨한 결합) ──▶ [tasks] (할일 백로그, 기존)
```

티켓 생성 시 `tasks`에 새 row가 함께 생성되지만 외래키는 두지 않는다 (포커스 맵→`tasks` 연동과 동일한 패턴). 이후 `tasks` 쪽에서 해당 항목을 삭제/완료해도 티켓 쪽 `registered` 값은 갱신되지 않으며, 반대로 티켓을 삭제해도 이미 생성된 `tasks` row는 남는다 — Plan §2.2 Out of Scope에 명시된 알려진 제약이다.

### 3.3 Database Schema

```sql
-- server/db/schema.sql 에 추가 (기존 tasks/schedules/focus_map 테이블은 변경 없음)

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  registered  INTEGER NOT NULL DEFAULT 0 CHECK (registered IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

> `server/db/database.js`가 이미 `PRAGMA foreign_keys = ON`을 실행하므로 `ON DELETE CASCADE`가 실제로 적용된다. 두 테이블 모두 `CREATE TABLE IF NOT EXISTS`라 기존 데이터에 영향 없이 최초 1회만 생성된다 (포커스 맵처럼 `DROP TABLE`이 필요한 breaking change 아님).

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/customers` | 고객사 목록 조회 (`id asc`) | 없음 (로컬 단일 사용자) |
| POST | `/api/customers` | 고객사 추가 | 없음 |
| DELETE | `/api/customers/:id` | 고객사 삭제 (연결 티켓 CASCADE 삭제) | 없음 |
| GET | `/api/customers/:id/tickets` | 해당 고객사의 티켓 목록 조회 (`id asc`) | 없음 |
| POST | `/api/customers/:id/tickets` | 해당 고객사에 티켓 추가 | 없음 |
| PATCH | `/api/tickets/:id/toggle` | 티켓의 `registered` 값 반전 | 없음 |
| PATCH | `/api/tickets/:id/desired-date` | 티켓의 `desired_date`(희망 일자) 설정/변경/해제 (v0.1.1 추가) | 없음 |
| DELETE | `/api/tickets/:id` | 티켓 삭제 | 없음 |

### 4.2 Detailed Specification

#### `GET /api/customers`

**Response (200):**
```json
[
  { "id": 2, "name": "acme", "createdAt": "2026-08-09 10:00:00" },
  { "id": 1, "name": "globex", "createdAt": "2026-08-09 09:00:00" }
]
```

#### `POST /api/customers`

**Request:** `{ "name": "acme" }`
**Response (201 Created)**: 생성된 고객사 객체
**Error**: `400` — 이름 누락/공백: `{ "error": "고객사명을 입력해주세요." }`

#### `DELETE /api/customers/:id`

**Response**: `204 No Content`
**Error**: `404` — 존재하지 않는 id: `{ "error": "찾을 수 없습니다." }`

#### `GET /api/customers/:id/tickets`

**Response (200):**
```json
[
  { "id": 5, "customerId": 2, "title": "로그인 오류 문의", "registered": 0, "createdAt": "2026-08-09 10:05:00" }
]
```
**Error**: `404` — 존재하지 않는 고객사 id

#### `POST /api/customers/:id/tickets`

**Request:** `{ "title": "로그인 오류 문의", "desired_date": "2026-08-20" }` (`desired_date`는 선택, 생략 시 `null`)
**Response (201 Created)**: 생성된 티켓 객체 (`registered: 0`)
**Error Responses:**
- `400` — 제목 누락/공백: `{ "error": "제목을 입력해주세요." }`
- `404` — 존재하지 않는 고객사 id

> 이 요청 성공 직후 클라이언트가 **별도로** 기존 `POST /api/tasks`를 `{ "title": "[${고객사명}] ${title}" }`로 호출한다 (서버 측 조인/트랜잭션 없음 — 포커스 맵의 "할일로 추가"와 동일하게 클라이언트 오케스트레이션).

#### `PATCH /api/tickets/:id/toggle`

**Request 본문 없음.**
**Response (200)**: 갱신된 티켓 객체 (`registered` 값이 반전됨)
**Error**: `404` — 존재하지 않는 id

#### `PATCH /api/tickets/:id/desired-date` (v0.1.1 추가)

**Request:** `{ "desired_date": "2026-08-25" }` (`null` 또는 빈 값이면 희망 일자 해제)
**Response (200)**: 갱신된 티켓 객체
**Error**: `404` — 존재하지 않는 id

#### `DELETE /api/tickets/:id`

**Response**: `204 No Content`
**Error**: `404` — 존재하지 않는 id

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ [일정관리] [포커스 맵] [고객사 티켓]                                    │  ← App.jsx 상단 탭 (기존 두 탭 변경 없음)
├───────────────────┬──────────────────────────────────────────────┤
│ 고객사              │  acme 의 티켓                        [ + ]      │
│ ───────────────    │  ──────────────────────────────────────────  │
│ [고객사명 입력] [추가] │  ○ 로그인 오류 문의                            │
│                    │  ✓ ~~결제 실패 재현 요청~~   (취소선 + 회색)      │
│ ● acme       [삭제] │                                              │
│ ○ globex     [삭제] │  (+ 클릭 시 제목 입력 UI가 목록 위에 나타남)       │
└───────────────────┴──────────────────────────────────────────────┘
```

### 5.2 User Flow

```
"고객사 티켓" 탭 진입 → 좌측 고객사 목록 로드
  ├─ 고객사명 입력 후 "추가" → 목록에 즉시 등장
  ├─ 고객사 클릭 → 우측 패널이 해당 고객사의 티켓 목록으로 갱신, 좌측에서 선택 강조
  ├─ 좌측 "삭제" 클릭 → 확인창(confirm) → 삭제 → 목록에서 제거, 선택 중이었다면 우측 빈 상태로 전환
  └─ (고객사 선택 중) 우측 "+" 클릭 → 제목 입력 → 확인
       → 티켓 목록에 즉시 추가(미등록 상태) + 일정관리 탭 할일 백로그에도 `[고객사명] 제목`으로 등장
       → 티켓 클릭(토글) → 취소선 + 회색으로 전환 (다시 클릭하면 원상태)
       → 티켓 "삭제" → 목록에서 제거 (백로그의 항목은 영향 없음)
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `CustomerTickets.jsx` | `client/src/components/CustomerTickets/` | 좌(고객사)·우(티켓) 레이아웃 컨테이너, `selectedCustomerId` 상태 보유, 티켓 생성 시 `addTask` 연동 |
| `CustomerList.jsx` | `client/src/components/CustomerTickets/` | 좌측 고객사 목록 표시/추가 입력/선택/삭제 (순수 표시) |
| `TicketPanel.jsx` | `client/src/components/CustomerTickets/` | 우측 티켓 목록 표시, "+" 입력 UI, 토글/삭제 이벤트 위임 (순수 표시) |
| `useCustomers` | `client/src/hooks/` | 고객사 목록 조회·생성·삭제 |
| `useTickets` | `client/src/hooks/` | 선택된 고객사의 티켓 조회·생성·토글·삭제 |

### 5.4 Page UI Checklist

#### 고객사 티켓 탭 — 좌측 목록 (CustomerList)

- [ ] 상단: 고객사명 입력 필드 + "추가" 버튼 (Enter로도 제출)
- [ ] 리스트 항목: 고객사명, 삭제 버튼
- [ ] 리스트 항목 클릭 시 해당 고객사 선택 + 시각적 강조(배경색/좌측 바, 기존 tab 강조 스타일과 톤 통일)
- [ ] 삭제 시 `confirm()`으로 1차 확인 (연결된 티켓이 함께 삭제됨을 안내)
- [ ] 빈 상태: 고객사가 없을 때 안내 문구 ("등록된 고객사가 없습니다" 등)

#### 고객사 티켓 탭 — 우측 티켓 패널 (TicketPanel)

- [ ] 고객사 미선택 시 "왼쪽에서 고객사를 선택해주세요" 안내만 표시 (FR-15)
- [ ] 고객사 선택 시: 헤더에 고객사명 + "+" 버튼
- [ ] "+" 클릭 시 제목 입력 UI 노출 → 확인 시 추가, 취소/빈 값이면 닫기
- [ ] 각 티켓 행: 클릭(또는 체크 아이콘)으로 토글, `registered=1`이면 `line-through text-gray-400`(취소선+회색), `registered=0`이면 기본 텍스트
- [ ] 각 티켓 행에 삭제 버튼
- [ ] 빈 상태: 티켓이 없을 때 안내 문구 ("등록된 티켓이 없습니다" 등)

---

## 6. Error Handling

### 6.1 Error Code Definition

기존 `tasks.js`/`schedules.js`/`focusmap.js`와 동일하게 `{ error: string }` 포맷을 유지한다.

| Status | 상황 | 메시지 |
|--------|------|--------|
| 400 | 고객사명 누락/공백으로 생성 시도 | `고객사명을 입력해주세요.` |
| 400 | 티켓 제목 누락/공백으로 생성 시도 | `제목을 입력해주세요.` |
| 404 | 존재하지 않는 고객사/티켓 id로 조회·생성·토글·삭제 | `찾을 수 없습니다.` |
| 500 | 예상 못한 서버 오류 | 기존 `index.js` 공통 에러 핸들러가 처리 (변경 없음) |

### 6.2 Error Response Format

```json
{ "error": "고객사명을 입력해주세요." }
```

프론트엔드는 기존 `TaskBacklog`/`FocusMap`과 동일하게 `alert(e.message)`로 실패를 표시한다 (신규 토스트/모달 컴포넌트 도입 안 함).

---

## 7. Security Considerations

로컬 단일 사용자 앱으로 외부 노출/인증이 없는 기존 구조를 그대로 유지한다.

- [ ] 입력 검증: `name`/`title`은 trim 후 빈 문자열 여부만 검사 (XSS는 React 기본 이스케이프에 의존, 기존과 동일)
- [ ] SQL Injection: 기존과 동일하게 `db.prepare().run(...)` 파라미터 바인딩만 사용, 문자열 concat 금지
- [ ] Rate Limiting / HTTPS: 해당 없음 (localhost 전용, 기존과 동일)

---

## 8. Test Plan

### 8.1 Test Scope

이 프로젝트는 자동화 테스트 도구가 설치되어 있지 않다 (기존 focusmap MVP와 동일). Do 단계에서도 자동 테스트 코드 대신 **수동 시나리오 검증**으로 대체한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API 확인 | 7개 엔드포인트 — 상태 코드/응답 형태 | `curl` 수동 실행 | Do |
| L2: UI 동작 확인 | §5.4 체크리스트 요소 | 브라우저 수동 조작 | Do |
| L3: E2E 시나리오 | 고객사 전환, 티켓 추가→백로그 반영, 토글 | 브라우저 수동 조작 | Do/Check |

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | 설명 | 기대 상태 | 기대 응답 |
|---|----------|--------|------|:--------:|-----------|
| 1 | `/api/customers` | GET | 빈 상태 조회 | 200 | `[]` |
| 2 | `/api/customers` | POST | name 없이 생성 시도 | 400 | `.error` 존재 |
| 3 | `/api/customers` | POST | 정상 생성 | 201 | `.id` 존재, `.name` 일치 |
| 4 | `/api/customers/:id/tickets` | GET | 티켓 없는 고객사 조회 | 200 | `[]` |
| 5 | `/api/customers/:id/tickets` | POST | title 없이 생성 시도 | 400 | `.error` 존재 |
| 6 | `/api/customers/:id/tickets` | POST | 정상 생성 | 201 | `.registered === 0` |
| 7 | `/api/tickets/:id/toggle` | PATCH | 토글 1회 | 200 | `.registered === 1` |
| 8 | `/api/tickets/:id/toggle` | PATCH | 토글 2회(원복) | 200 | `.registered === 0` |
| 9 | `/api/tickets/:id` | DELETE | 삭제 | 204 | 이후 목록 조회 시 미포함 |
| 10 | `/api/customers/:id` | DELETE | 고객사 삭제 (티켓 보유 상태) | 204 | 연결 티켓도 함께 삭제됨 (CASCADE) |
| 11 | `/api/customers/:id` | GET-tickets | 없는 고객사 id로 조회 | 404 | `.error` 존재 |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | 고객사 티켓 탭 | 로드 | 좌측에 고객사 목록 또는 빈 상태 문구 표시 | `GET /api/customers` 응답과 일치 |
| 2 | 고객사 티켓 탭 | 고객사 추가 | 목록에 즉시 등장 | `POST /api/customers` 호출 확인 |
| 3 | 고객사 티켓 탭 | 고객사 클릭 | 우측 패널이 해당 고객사 티켓으로 갱신, 좌측 강조 | `GET /api/customers/:id/tickets` 응답과 일치 |
| 4 | 고객사 티켓 탭 | "+"로 티켓 추가 | 티켓 목록에 즉시 등장(미등록) | `GET /api/customers/:id/tickets`에 신규 항목 |
| 5 | 일정관리 탭 | 위 4번 직후 전환 | 할일 백로그에 `[고객사명] 제목` 항목 등장 | `GET /api/tasks`에 신규 항목 |
| 6 | 고객사 티켓 탭 | 티켓 클릭(토글) | 취소선 + 회색으로 표시 변경 | `.registered === 1` |
| 7 | 고객사 티켓 탭 | 고객사 삭제 | 좌측 목록에서 제거, 선택 중이었다면 우측 빈 상태로 전환 | `DELETE` 호출 후 목록 재조회 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 고객사 2개 전환 | acme 추가 → 티켓 1개 추가 → globex 추가 → globex 선택 → acme 다시 선택 | acme 선택 시 방금 추가한 티켓이 그대로 남아있음, globex는 빈 목록 |
| 2 | 티켓 추가 → 백로그 반영 | acme에 "결제 실패 재현 요청" 티켓 추가 → 일정관리 탭 이동 | 할일 백로그에 `[acme] 결제 실패 재현 요청` 항목 존재, 드래그로 시간표 배치 가능 |
| 3 | 토글 후 새로고침 | 티켓 토글(등록됨) → 새로고침 → 고객사 다시 선택 | 취소선+회색 상태 유지 (서버에 영속화됨) |

### 8.5 Seed Data Requirements

없음 — Do/Check 단계에서 수동으로 고객사 1~2개, 티켓 2~3개를 생성해 검증한다.

---

## 9. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다 (Next.js/DI 컨테이너 등은 도입하지 않음).

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/이벤트 처리 | `client/src/components/CustomerTickets/` |
| **Application (Hooks)** | 고객사/티켓 로드·생성·토글·삭제 오케스트레이션, `tasks` 연동 호출 | `client/src/hooks/useCustomers.js`, `useTickets.js` |
| **Infrastructure** | HTTP 통신, DB 접근 | `client/src/api/customers.js`, `api/tickets.js`, `server/routes/customers.js`, `routes/tickets.js` |
| **Domain** | `Customer`/`Ticket` 구조 (§3.1) | 별도 타입 파일 없이 JSDoc으로 문서화 (프로젝트가 순수 JS) |

### 9.2 Dependency Rules

```
컴포넌트(Presentation) ──▶ 훅(Application) ──▶ api 모듈(Infrastructure) ──▶ fetch
훅은 컴포넌트를 import하지 않는다 (단방향, 기존 useTasks/useFocusMap과 동일한 규칙)
CustomerTickets.jsx는 자체 useTasks()를 새로 만들지 않고, App.jsx가 이미 보유한 addTask를 props로 전달받는다
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `CustomerTickets.jsx` | Presentation | `client/src/components/CustomerTickets/CustomerTickets.jsx` |
| `CustomerList.jsx` | Presentation | `client/src/components/CustomerTickets/CustomerList.jsx` |
| `TicketPanel.jsx` | Presentation | `client/src/components/CustomerTickets/TicketPanel.jsx` |
| `useCustomers` | Application | `client/src/hooks/useCustomers.js` |
| `useTickets` | Application | `client/src/hooks/useTickets.js` |
| `api/customers.js` | Infrastructure | `client/src/api/customers.js` |
| `api/tickets.js` | Infrastructure | `client/src/api/tickets.js` |
| `routes/customers.js` | Infrastructure | `server/routes/customers.js` |
| `routes/tickets.js` | Infrastructure | `server/routes/tickets.js` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다 (신규 규칙 없음): 컴포넌트 PascalCase, 훅 `useXxx` camelCase, 함수 camelCase, 폴더는 기능 단위 PascalCase(`CustomerTickets/`).

### 10.2 Import Order

기존 파일들의 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다. 강제 ESLint/Prettier 설정 없음.

### 10.3 Environment Variables

신규 환경변수 없음 — 기존 `PORT`, `DB_PATH`를 재사용한다.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 리소스당 파일 수 | `customers`는 API 1파일 + 라우트 1파일, `tickets`도 API 1파일 + 라우트 1파일 — `tasks.js`/`schedules.js`와 동일 |
| 상태 관리 | 로컬 React state + custom hook, 전역 스토어 도입 안 함 |
| 에러 처리 | `{ error: string }` 한국어 메시지 + 프론트 `alert()`, 기존과 동일 |
| 신규 도메인 → 기존 도메인 연동 | 서버 조인/트랜잭션 없이, 클라이언트가 두 API(POST 티켓 → POST 할일)를 순차 호출 (포커스 맵과 동일 패턴) |

---

## 11. Implementation Guide

### 11.1 File Structure

```
server/
├── db/schema.sql                        (수정 — customers, tickets 테이블 추가)
├── routes/customers.js                  (신규 — GET/POST /, DELETE /:id, GET/POST /:id/tickets)
├── routes/tickets.js                    (신규 — PATCH /:id/toggle, DELETE /:id)
├── index.js                              (수정 — /api/customers, /api/tickets 라우트 등록)
client/src/
├── api/customers.js                     (신규 — listCustomers, addCustomer, deleteCustomer, listTickets, addTicket)
├── api/tickets.js                       (신규 — toggleTicket, deleteTicket)
├── hooks/useCustomers.js                (신규 — 고객사 목록 조회/생성/삭제)
├── hooks/useTickets.js                  (신규 — 선택된 고객사의 티켓 조회/생성/토글/삭제)
├── components/CustomerTickets/
│   ├── CustomerTickets.jsx               (신규 — 좌우 레이아웃 컨테이너)
│   ├── CustomerList.jsx                  (신규 — 좌측 고객사 목록)
│   └── TicketPanel.jsx                   (신규 — 우측 티켓 패널)
└── App.jsx                               (수정 — TABS에 항목 추가, 신규 탭 렌더링 블록 추가, addTask를 CustomerTickets에 전달)
```

### 11.2 Implementation Order

1. [ ] `server/db/schema.sql` — `customers`, `tickets` 테이블 추가
2. [ ] `server/routes/customers.js` — `GET /`, `POST /`, `DELETE /:id`, `GET /:id/tickets`, `POST /:id/tickets` 구현
3. [ ] `server/routes/tickets.js` — `PATCH /:id/toggle`, `DELETE /:id` 구현
4. [ ] `server/index.js` — 두 라우트 등록 (`/api/customers`, `/api/tickets`)
5. [ ] `client/src/api/customers.js`, `api/tickets.js` — fetch 래퍼 작성
6. [ ] `client/src/hooks/useCustomers.js` — 목록 조회/생성/삭제
7. [ ] `client/src/hooks/useTickets.js` — `customerId` 인자를 받아 티켓 조회/생성/토글/삭제, `customerId` 변경 시 재조회
8. [ ] `client/src/components/CustomerTickets/CustomerList.jsx` — 좌측 목록 (신규 작성)
9. [ ] `client/src/components/CustomerTickets/TicketPanel.jsx` — 우측 패널, 토글 시 취소선+회색 스타일 적용 (신규 작성)
10. [ ] `client/src/components/CustomerTickets/CustomerTickets.jsx` — 컨테이너 조립, 티켓 생성 성공 시 `addTask(`[${customer.name}] ${title}`)` 호출
11. [ ] `client/src/App.jsx` — `TABS`에 `{ id: 'customers', label: '고객사 티켓' }` 추가, 조건부 렌더링 블록 추가, `addTask`를 `CustomerTickets`에 props로 전달 (기존 `tab === 'schedule'`/`'focusmap'` 블록은 변경하지 않음)
12. [ ] §8.2~8.4 수동 시나리오 검증

### 11.3 Session Guide

> Session 1(Plan+Design)은 본 문서로 완료. `/pdca do customer-tickets --scope module-N`으로 모듈별 구현 가능.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---:|
| 백엔드 (스키마+API) | `module-1` | `schema.sql`, `routes/customers.js`, `routes/tickets.js`, `index.js` | 8-10 |
| 클라이언트 데이터층 | `module-2` | `api/customers.js`, `api/tickets.js`, `useCustomers.js`, `useTickets.js` | 8-10 |
| UI (좌우 레이아웃 + 토글) | `module-3` | `CustomerList.jsx`, `TicketPanel.jsx`, `CustomerTickets.jsx` | 10-12 |
| 탭/백로그 연동 | `module-4` | `App.jsx` 수정(탭 추가, addTask 연동) | 4-6 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 (본 문서) |
| Session 2 | Do | `--scope module-1,module-2` | 16-20 |
| Session 3 | Do | `--scope module-3,module-4` | 14-18 |
| Session 4 | Check + Report | 전체 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | Initial draft (Option B 선택) | Mincoln Cho |
| 0.2 | 2026-08-09 | `desired_date`(희망 일자, 선택·수정 가능) 필드 및 `PATCH /:id/desired-date` 추가 | Mincoln Cho |
