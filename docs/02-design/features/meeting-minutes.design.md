---
template: design
version: 1.3
---

# meeting-minutes Design Document

> **Summary**: 회의록을 날짜별로 기록하는 새 탭의 설계 — `long_goals` 기능의 컨벤션(단일 라우트 파일, 결합 GET, `editingXId`+`xEditForm` 인라인 편집 패턴, 단일 훅)을 그대로 재사용하고, 액션아이템 자동생성을 위한 외부 LLM 호출은 `services/notifications.js`와 동일하게 별도 서비스 모듈로 분리한다
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-01
> **Status**: Draft
> **Planning Doc**: [meeting-minutes.plan.md](../../01-plan/features/meeting-minutes.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document (v0.2). Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 회의 내용을 기록할 구조화된 화면이 없어 공유사항/파트별 진행상황/액션아이템이 흩어져 관리됨 |
| **WHO** | 회의 결과를 정리하고 액션아이템을 추적해야 하는 사용자(팀 리드/매니저) |
| **RISK** | 세 섹션의 필드 구성이 서로 달라 섹션별 테이블 분리 필요. 외부 AI API 키는 반드시 서버 환경변수로만 보관하고 클라이언트에 노출되지 않아야 함 |
| **SUCCESS** | 날짜 입력으로 회의록 생성 → 세 섹션에 항목 추가/수정/삭제 → 새로고침 후에도 유지 → 목록에서 과거 회의록 재조회. 액션아이템은 원문 붙여넣기만으로 AI가 자동 생성 |
| **SCOPE** | (1) 4개 신규 테이블 (2) `/api/meetings` REST API (3) 목록+상세 UI(DateNavigator 재사용) (4) 새 탭 등록 (5) 액션아이템 AI 자동생성(서버 사이드 전용, API 키는 서버 환경변수 전용) |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 0. ⚠️ Security Precondition (필독)

> `/pdca design` 요청 중 사용자가 실제 운영 중인 AI API 키를 대화창에 붙여넣었다. 이 문서와 이후 구현 코드 어디에도 그 키 값을 **그대로 기록하지 않는다**. 아래 설계는 키를 서버 프로세스 환경변수로만 주입받는 것을 전제로 하며, 사용자에게는 해당 키를 세션 로그 노출 가능성을 이유로 재발급(rotate) 하도록 이미 권고했다.

- 키는 코드/DB/Git/클라이언트 응답 어디에도 포함되지 않는다.
- 서버는 `process.env.MEETING_AI_API_KEY`로만 키를 읽는다.
- `.env`는 이미 `.gitignore`에 포함되어 있음 (`server/.env`, 프로젝트 루트 기준 `.env` 항목 존재) — 신규 `.env.example`에는 플레이스홀더만 기록한다.

---

## 1. Overview

### 1.1 Design Goals

- 회의록(부모) + 3개 섹션(전체/파트별/액션아이템) 자식 컬렉션을, `long_goals`와 동일한 "결합 GET + 섹션별 CRUD 엔드포인트" 구조로 관리한다.
- 목록→상세 화면 전환과 섹션별 인라인 추가/수정 UX는 `LongGoals.jsx`에서 이미 검증된 `editingXId` + `xEditForm` 패턴을 그대로 재사용한다.
- 액션아이템 자동생성은 **반드시 서버에서만** 외부 LLM API를 호출하도록 격리해, API 키가 브라우저에 노출될 경로를 원천 차단한다.

### 1.2 Design Principles

- **컨벤션 재사용 우선**: 새 라우트 파일(`meetings.js`)은 `longgoals.js`의 `handleRoute`/`assertX`/`maxPosition`/`requireTitle`/`optionalText` 헬퍼를 그대로 가져와 쓴다.
- **외부 호출은 서비스로 분리**: `services/notifications.js`가 이미 "외부 HTTP 호출 로직을 라우트에서 분리"하는 전례이므로, LLM 호출도 `services/meetingAi.js`로 분리해 라우트는 얇게 유지한다.
- **AI는 보조 기능**: AI 생성이 실패해도 액션아이템 섹션은 수동 CRUD로 항상 동작해야 한다 — AI 경로는 기존 CRUD 위에 얹는 부가 엔드포인트 하나일 뿐이다.
- **단순함 우선**: 인증, 페이지네이션, 실시간 동기화, 낙관적 업데이트를 도입하지 않는다 — 서버 액션 후 전체 재조회로 최신 상태를 반영한다.

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal (LongGoals 컨벤션 그대로) | Option B: Clean (섹션별 컴포넌트 분리) | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | `MeetingMinutes.jsx` 단일 파일에 목록+상세+3섹션 인라인 편집 폼 모두 포함 (`LongGoals.jsx`와 동일 형태) | `MeetingList/Detail/OverallSection/PartSection/ActionItemSection` 5개 컴포넌트로 분리 | 컨테이너(목록+상세 전환)만 분리하고, 3섹션은 단일 파일에 유지하되 액션아이템 행만 별도 소형 컴포넌트로 추출 |
| **New Files (client)** | 3 (`MeetingMinutes.jsx`, `useMeetings.js`, `api/meetings.js`) | 8 | 4 |
| **New Files (server)** | 3 (`routes/meetings.js`, `services/meetingAi.js`, schema 수정) | 동일 | 동일 |
| **Complexity** | Low | Medium | Low-Medium |
| **Maintainability** | High — `LongGoals.jsx`를 유지보수해본 사람이면 바로 이해 가능한 동일 패턴 | Medium — 섹션 간 공유 상태(선택된 회의록 id)를 props로 계속 내려야 해 경계가 다소 인위적 | High |
| **Effort** | Low | Medium-High | Low-Medium |
| **Risk** | Low | Low | Low |
| **Recommendation** | **Default choice** | 섹션이 각각 훨씬 커지면 고려 | Option A와 실질적으로 동일, 파일만 1개 더 |

**Selected**: **Option A — Minimal, `LongGoals.jsx` 컨벤션 그대로 재사용**
**Rationale**: 이 기능은 구조적으로 `long_goals`(부모 1개 + 성격이 다른 자식 컬렉션 3개)와 완전히 동일하다. `LongGoals.jsx`가 이미 "목록→상세 전환 + 섹션별 `editingXId`/`xEditForm` 인라인 편집" 패턴을 단일 파일로 검증했으므로, 새 컨벤션을 만들지 않고 그대로 복제하는 것이 가장 단순하고 유지보수 예측 가능성이 높다. 외부 LLM 호출만 예외적으로 `services/meetingAi.js`로 분리한다(§1.2 참고 — 이 부분은 `notifications.js` 전례를 따름).

> 아래 상세 설계는 Option A를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌───────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────┐
│ MeetingMinutes 탭  │─────▶│ Express /api/meetings 라우트 │─────▶│ SQLite                   │
│ (목록 + 상세, SPA) │◀─────│ (GET/POST/PATCH/DELETE)     │◀─────│ meetings                 │
└─────────┬──────────┘      └──────────────┬──────────────┘      │ meeting_overall_items   │
          │                                 │ POST .../generate   │ meeting_part_items      │
          │                                 ▼                     │ meeting_action_items    │
          │                        ┌──────────────────┐          └─────────────────────────┘
          │                        │ services/meetingAi│
          │                        │  (외부 LLM 호출)   │
          │                        └────────┬──────────┘
          │                                 ▼
          │                     ┌─────────────────────────────┐
          │                     │ 외부 LLM API                 │
          │                     │ (OpenAI 호환 Chat Completions)│
          │                     └─────────────────────────────┘
          └─ useMeetings() 훅으로 전체 상태 로드/액션 오케스트레이션
```

### 2.2 Data Flow

```
탭 진입 → useMeetings()가 GET /api/meetings 호출 → 회의록 목록 로드
  → 날짜 입력(DateNavigator 재사용) + "회의록 생성" → POST /api/meetings { date } → 목록 재조회
  → 목록에서 회의록 선택 → GET /api/meetings/:id → { meeting, overall_items, part_items, action_items } 로드
  → "전체" 섹션 항목 추가/수정/삭제 → POST/PATCH/DELETE .../overall-items(/:id) → 상세 재조회
  → "파트별" 섹션 항목 추가/수정/삭제 → POST/PATCH/DELETE .../part-items(/:id) → 상세 재조회
  → "액션아이템" 수동 추가/수정/삭제 → POST/PATCH/DELETE .../action-items(/:id) → 상세 재조회
  → "액션아이템" AI 자동생성:
      원문 텍스트를 입력 → POST /api/meetings/:id/action-items/generate { notes }
        → 서버: services/meetingAi.generateActionItems(notes) 호출(외부 LLM)
        → 파싱 성공 시 항목 배열을 meeting_action_items에 일괄 INSERT
        → 파싱 실패 시 원문을 1개 항목(content)으로 대체 INSERT (정보 손실 방지)
        → 생성된 항목 배열 반환 → 클라이언트는 상세 재조회로 최신 목록 표시
  → 회의록 삭제 → 확인 다이얼로그 → DELETE /api/meetings/:id → 목록 재조회
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `MeetingMinutes.jsx` | `useMeetings`, `DateNavigator`(재사용) | 목록/상세 전환 컨테이너, 3섹션 렌더 + 인라인 편집 폼 |
| `useMeetings.js` | `api/meetings.js` | 목록/상세 상태 로드 + 모든 액션(회의록/섹션 항목 CRUD, AI 생성 트리거) |
| `routes/meetings.js` | `services/meetingAi.js`, `db/database.js` | REST 엔드포인트, DB 접근, AI 생성 라우트에서 서비스 호출 |
| `services/meetingAi.js` | 외부 LLM API, `process.env.MEETING_AI_*` | 프롬프트 구성, 외부 호출, 응답 파싱/검증 |

---

## 3. Data Model

### 3.1 Entity Definition

```
Meeting
{
  id: number,
  date: string,       // 'YYYY-MM-DD'
  created_at: string,
}

MeetingOverallItem
{
  id: number,
  meeting_id: number,
  kind: 'share' | 'request' | 'project',   // 공유 / 요청 / 진행프로젝트
  content: string,
  position: number,
  created_at: string,
}

MeetingPartItem
{
  id: number,
  meeting_id: number,
  assignee: string,     // 담당자
  progress: string | null,  // 진행사항
  request: string | null,   // 요청사항
  position: number,
  created_at: string,
}

MeetingActionItem
{
  id: number,
  meeting_id: number,
  task_type: string,    // 업무구분
  content: string,      // 내용
  status: '대기' | '진행중' | '완료',
  due_date: string | null,   // 기한 — 자유 텍스트("8/27", "목요일", "2026-09-08" 등 원문 표현을 그대로 허용)
  assignee: string | null,   // 담당자
  position: number,
  created_at: string,
}

MeetingDetail  // GET /api/meetings/:id 응답 shape
{
  meeting: Meeting,
  overall_items: MeetingOverallItem[],
  part_items: MeetingPartItem[],
  action_items: MeetingActionItem[],
}
```

### 3.2 Entity Relationships

```
[meetings] 1 ──── N [meeting_overall_items]  (meeting_id, ON DELETE CASCADE)
[meetings] 1 ──── N [meeting_part_items]     (meeting_id, ON DELETE CASCADE)
[meetings] 1 ──── N [meeting_action_items]   (meeting_id, ON DELETE CASCADE)
```

### 3.3 Database Schema

`server/db/schema.sql`에 아래 4개 테이블을 추가한다 (기존 테이블 무변경):

```sql
-- 회의록 (날짜 기준, 하루 여러 건 허용 — UNIQUE 제약 없음)
CREATE TABLE IF NOT EXISTS meetings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 회의록 "전체" 섹션 — 공유(share) / 요청(request) / 진행프로젝트(project)
CREATE TABLE IF NOT EXISTS meeting_overall_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL DEFAULT 'share' CHECK (kind IN ('share', 'request', 'project')),
  content    TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 회의록 "파트별" 섹션 — 담당자/진행사항/요청사항
CREATE TABLE IF NOT EXISTS meeting_part_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  assignee   TEXT    NOT NULL,
  progress   TEXT,
  request    TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 회의록 "액션아이템" 섹션 — 업무구분/내용/상태/기한/담당자 (수동 입력 + AI 자동생성 공용)
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  task_type  TEXT    NOT NULL DEFAULT '기타',
  content    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT '대기' CHECK (status IN ('대기', '진행중', '완료')),
  due_date   TEXT,
  assignee   TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

> `database.js`가 `PRAGMA foreign_keys = ON`을 이미 켜두므로 `ON DELETE CASCADE`가 그대로 동작한다. 신규 테이블이라 `CREATE TABLE IF NOT EXISTS`만으로 충분하다.

---

## 4. API Specification

### 4.1 Endpoint List

라우트 파일 1개(`server/routes/meetings.js`)에 전체 CRUD + AI 생성 엔드포인트를 모아 `/api/meetings`에 마운트한다 (`long_goals`와 동일한 형태).

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/meetings` | 회의록 목록(날짜 최신순, 섹션 미포함) | 없음 |
| POST | `/api/meetings` | 회의록 생성 | 없음 |
| GET | `/api/meetings/:id` | 회의록 상세(3개 섹션 포함) | 없음 |
| DELETE | `/api/meetings/:id` | 회의록 삭제 (섹션 항목 CASCADE) | 없음 |
| POST | `/api/meetings/:id/overall-items` | "전체" 섹션 항목 추가 | 없음 |
| PATCH | `/api/meetings/overall-items/:id` | "전체" 섹션 항목 수정 | 없음 |
| DELETE | `/api/meetings/overall-items/:id` | "전체" 섹션 항목 삭제 | 없음 |
| POST | `/api/meetings/:id/part-items` | "파트별" 섹션 항목 추가 | 없음 |
| PATCH | `/api/meetings/part-items/:id` | "파트별" 섹션 항목 수정 | 없음 |
| DELETE | `/api/meetings/part-items/:id` | "파트별" 섹션 항목 삭제 | 없음 |
| POST | `/api/meetings/:id/action-items` | 액션아이템 수동 추가 | 없음 |
| PATCH | `/api/meetings/action-items/:id` | 액션아이템 수정 | 없음 |
| DELETE | `/api/meetings/action-items/:id` | 액션아이템 삭제 | 없음 |
| POST | `/api/meetings/:id/action-items/generate` | 회의 원문에서 AI가 액션아이템을 추출해 일괄 생성 | 없음(서버가 별도 서버 키로 외부 API 인증) |

### 4.2 Detailed Specification

#### `GET /api/meetings`

**Response (200):**
```json
[
  { "id": 3, "date": "2026-09-01", "created_at": "2026-09-01 09:00:00" },
  { "id": 2, "date": "2026-08-25", "created_at": "2026-08-25 09:10:00" }
]
```

#### `POST /api/meetings`

**Request:** `{ "date": "2026-09-01" }`
**Response (201)**: 생성된 회의록 객체
**Error**: `400` — 날짜 공백: `{ "error": "회의 날짜를 입력해주세요." }`

#### `GET /api/meetings/:id`

**Response (200):**
```json
{
  "meeting": { "id": 3, "date": "2026-09-01", "created_at": "2026-09-01 09:00:00" },
  "overall_items": [
    { "id": 10, "meeting_id": 3, "kind": "share", "content": "3.0.1 Release 패키징 완료", "position": 0 }
  ],
  "part_items": [
    { "id": 20, "meeting_id": 3, "assignee": "BE", "progress": "개발자 온보딩 작업 수행", "request": null, "position": 0 }
  ],
  "action_items": [
    { "id": 30, "meeting_id": 3, "task_type": "Release", "content": "3.0.1 Jackson 호환 Hotfix", "status": "진행중", "due_date": "진행 중", "assignee": "BE", "position": 0 }
  ]
}
```
**Error**: `404` — `{ "error": "회의록을 찾을 수 없습니다." }`

#### `DELETE /api/meetings/:id`

**Response**: `204 No Content` (섹션 항목 CASCADE 삭제)
**Error**: `404`

#### `POST /api/meetings/:id/overall-items`

**Request:** `{ "kind": "share", "content": "3.0.1 Release 패키징 완료" }`
**Response (201)**: 생성된 항목 객체
**Error**: `400` — 내용 공백, `404` — 존재하지 않는 회의록

#### `PATCH /api/meetings/overall-items/:id`

**Request:** `{ "kind": "request", "content": "..." }` (부분 갱신)
**Response (200)**: 갱신된 항목 객체
**Error**: `404`

#### `DELETE /api/meetings/overall-items/:id`

**Response**: `204 No Content` / **Error**: `404`

#### `POST /api/meetings/:id/part-items`

**Request:** `{ "assignee": "BE", "progress": "...", "request": "..." }`
**Response (201)**: 생성된 항목 객체 (`assignee` 필수, `progress`/`request`는 선택)
**Error**: `400` — 담당자 공백, `404`

#### `PATCH` / `DELETE` `.../part-items/:id`

기존 항목과 동일한 패턴 (부분 갱신 / 삭제, `404` 시 동일 에러 포맷).

#### `POST /api/meetings/:id/action-items`

**Request:** `{ "task_type": "Release", "content": "...", "status": "진행중", "due_date": "진행 중", "assignee": "BE" }` (`status`/`due_date`/`assignee`는 선택, 기본값 `대기`/`null`/`null`)
**Response (201)**: 생성된 항목 객체
**Error**: `400` — 내용 공백 또는 올바르지 않은 `status`, `404`

#### `PATCH` / `DELETE` `.../action-items/:id`

기존 항목과 동일한 패턴.

#### `POST /api/meetings/:id/action-items/generate`

**Request:** `{ "notes": "<회의 원문 텍스트, 자유 형식>" }`
**Response (201)**: 생성된 액션아이템 배열 (수동 추가와 동일한 shape)
```json
[
  { "id": 31, "meeting_id": 3, "task_type": "MCP", "content": "연결은 정상이나 Tool 호출 불가 원인 점검", "status": "대기", "due_date": "확인 필요", "assignee": "BE", "position": 1 }
]
```
**Error**:
- `400` — 원문 공백: `{ "error": "회의 원문을 입력해주세요." }`
- `500` — 서버에 `MEETING_AI_API_KEY`가 설정되지 않음: `{ "error": "AI 기능이 설정되지 않았습니다. 서버 관리자에게 문의해주세요." }`
- `502` — 외부 API 호출 실패/타임아웃: `{ "error": "AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요." }`
- `404` — 존재하지 않는 회의록

---

## 5. AI Integration Detail

### 5.1 외부 API 연동 개요

| 항목 | 값 |
|------|-----|
| 방식 | OpenAI 호환 Chat Completions (`POST {MEETING_AI_API_URL}`) |
| 인증 | `Authorization: Bearer {MEETING_AI_API_KEY}` — 서버 프로세스 환경변수에서만 로드 |
| 모델 | `MEETING_AI_MODEL` (기본값: 사용자가 제공한 예시의 `qwen3.8-max`) |
| 호출 주체 | **서버만** (`server/services/meetingAi.js`) — 클라이언트는 원문 텍스트만 서버로 전송하고, 외부 API 키/URL을 알지 못한다 |

### 5.2 프롬프트 설계

시스템 프롬프트는 "회의 원문에서 액션아이템만 추출해 JSON 배열로만 응답"하도록 강하게 제약한다:

```
당신은 회의록에서 액션아이템(후속 조치)만 추출하는 도구입니다.
아래 회의 원문을 읽고, 각 액션아이템을 다음 필드를 가진 JSON 객체로 추출해
JSON 배열 하나만 응답하세요. 다른 설명, 마크다운, 코드펜스는 포함하지 마세요.

- task_type: 업무 구분(예: "Release", "MCP", "북미 SDS" 등 원문에 드러난 카테고리, 없으면 "기타")
- content: 액션아이템 내용 (한 문장 요약)
- status: "대기" | "진행중" | "완료" 중 하나 (원문에 "진행 중"이 있으면 "진행중", "완료"/"됨"이 있으면 "완료", 그 외 "대기")
- due_date: 원문에 표현된 일정/기한 문구를 그대로 (예: "8/27", "금일 오후", "목요일"), 없으면 null
- assignee: 담당자/담당 파트 (예: "BE", "지니", "박찬준"), 없으면 null

예시 응답: [{"task_type":"Release","content":"3.0.1 Jackson 호환 Hotfix","status":"진행중","due_date":"진행 중","assignee":"BE"}]
```

사용자 메시지에는 붙여넣은 회의 원문 텍스트를 그대로 전달한다.

> 사용자가 예시로 제시한 "주요 이슈 / Action Item" 표(구분/내용/담당/일정)는 이 프롬프트가 만들어내려는 최종 데이터의 참고 예시로 사용하며, 화면에는 마크다운 표가 아니라 기존 액션아이템 섹션의 행(row) 목록으로 렌더링한다 — 다른 섹션(주요 공통사항/BE/FE/SE 서술형 요약)은 이번 스코프에 포함하지 않는다(Plan §2.2 Out of Scope와 일관).

### 5.3 응답 파싱 및 검증 (`services/meetingAi.js`)

```js
// server/services/meetingAi.js
const DEFAULT_API_URL = 'https://ws-njn2s84z1yxzk1nf.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
const MEETING_AI_API_URL = process.env.MEETING_AI_API_URL || DEFAULT_API_URL;
const MEETING_AI_MODEL = process.env.MEETING_AI_MODEL || 'qwen3.8-max';
const VALID_STATUSES = new Set(['대기', '진행중', '완료']);

const SYSTEM_PROMPT = `...(§5.2 프롬프트)...`;

async function generateActionItems(notes) {
  const apiKey = process.env.QWEN_KEY;
  if (!apiKey || !MEETING_AI_API_URL) {
    const err = new Error('AI 기능이 설정되지 않았습니다. 서버 관리자에게 문의해주세요.');
    err.status = 500;
    throw err;
  }

  let response;
  try {
    response = await fetch(MEETING_AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MEETING_AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: notes },
        ],
      }),
    });
  } catch {
    const err = new Error('AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    const err = new Error('AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseActionItems(text, notes);
}

function parseActionItems(text, rawNotes) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const items = (Array.isArray(parsed) ? parsed : parsed.items).map((item) => ({
      task_type: String(item.task_type ?? '기타').trim() || '기타',
      content: String(item.content ?? '').trim(),
      status: VALID_STATUSES.has(item.status) ? item.status : '대기',
      due_date: item.due_date ? String(item.due_date).trim() : null,
      assignee: item.assignee ? String(item.assignee).trim() : null,
    })).filter((item) => item.content);
    if (items.length === 0) throw new Error('empty');
    return items;
  } catch {
    // FR-13: 파싱 실패 시 원문을 잃지 않도록 단일 항목으로 대체
    return [{
      task_type: '기타',
      content: (text.trim() || rawNotes).slice(0, 500),
      status: '대기',
      due_date: null,
      assignee: null,
    }];
  }
}

module.exports = { generateActionItems };
```

### 5.4 라우트의 async 예외 처리 확장

기존 `longgoals.js`의 `handleRoute`는 동기 함수만 가정한다. 이번 기능은 최초로 `await`가 필요한 라우트이므로, `meetings.js`에서는 async-safe 버전으로 확장한다:

```js
function handleRoute(fn) {
  return (req, res, next) => {
    // fn(req,res)를 .then() 콜백 안에서 호출해야 동기 throw도 프로미스 거부로 전환되어 catch에 잡힌다.
    // Promise.resolve(fn(req,res))처럼 인자 평가 단계에서 바로 호출하면 동기 throw가 catch를 건너뛰고 그대로 전파된다(실제 구현 중 발견/수정).
    Promise.resolve().then(() => fn(req, res)).catch((err) => {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    });
  };
}
```

동기 함수의 즉시 `throw`와 async 함수의 `await` 이후 reject를 모두 동일하게 처리하므로, 기존 동기 라우트 핸들러와 100% 호환된다 (기존 `longgoals.js`를 수정할 필요는 없음 — `meetings.js`에만 이 버전을 사용).

### 5.5 환경변수

> **v0.2 변경**: 사용자가 API 키를 프로젝트 루트 `.env`(`D:\repo\time_base_todolist\.env`, 이미 존재·gitignored)에 `QWEN_KEY`라는 이름으로 이미 저장해두었다. 이 구조를 그대로 사용한다 — 키 이름을 `MEETING_AI_API_KEY`로 새로 만들지 않는다.

`CLAUDE.md`의 Environment Variables 표에 아래를 추가한다:

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `QWEN_KEY` | (필수, 기본값 없음) | 액션아이템 자동생성용 AI API 인증 키 — 프로젝트 루트 `.env`에 저장됨(gitignored), **절대 커밋 금지** |
| `MEETING_AI_API_URL` | 사용자가 제공한 엔드포인트(Aliyun MaaS `compatible-mode/v1/chat/completions`)로 하드코딩된 기본값 | 필요 시 `.env`에 추가해 override 가능 |
| `MEETING_AI_MODEL` | `qwen3.8-max` | 필요 시 `.env`에 추가해 override 가능 |

프로젝트 루트 `.env`는 `server/`가 아니라 저장소 루트에 위치하므로(`.gitignore`의 `.env` 항목이 위치와 무관하게 이미 커버), `server/index.js`는 `dotenv`로 **루트 `.env`를 명시 경로로 지정**해 로드한다:

```js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
```

저장소에는 `server/.env.example`을 추가해 키 이름만 문서화하고 실제 값은 비워둔다(실제 `.env`는 루트에 있지만, 예시 파일은 서버가 참조하는 변수 목록을 보여주는 용도로 `server/` 아래 둔다):

```
# server/.env.example — 실제 값은 프로젝트 루트 .env에 저장
QWEN_KEY=
MEETING_AI_API_URL=
MEETING_AI_MODEL=qwen3.8-max
```

---

## 6. UI/UX Design

### 6.1 Screen Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [일정관리]...[업무 배치 보드][회의록]                                        │ ← App.jsx 상단 탭 (신규 탭 1개)
├──────────────────────────────────────────────────────────────────────────┤
│ (목록 화면)                                                                │
│ ◀  2026-09-01  ▶   [+ 이 날짜로 회의록 생성]   ← 기존 DateNavigator 재사용    │
│                                                                            │
│ 회의록 목록                                                                │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 2026-09-01                                                    [삭제] │ │  ← 클릭 시 상세 진입
│ │ 2026-08-25                                                    [삭제] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ (상세 화면 — 회의록 선택 시)                                                │
│ [◀ 목록으로]   2026-09-01                                                 │
│                                                                            │
│ ▌전체                                                                     │
│  [구분: 공유 ▾] [내용_______________] [+ 추가]                            │
│  · (공유) 3.0.1 Release 패키징 완료                    [수정][삭제]         │
│  · (요청) Tool 호출 불가 원인 점검 필요                  [수정][삭제]         │
│                                                                            │
│ ▌파트별                                                                   │
│  [담당자____] [진행사항_______] [요청사항_______] [+ 추가]                  │
│  · BE — 개발자 온보딩 작업 수행 / (요청없음)             [수정][삭제]         │
│                                                                            │
│ ▌액션아이템                                                                │
│  [회의 원문 붙여넣기_________________________________] [AI로 자동생성]      │
│  [업무구분] [내용] [상태▾] [기한] [담당자] [+ 수동 추가]                     │
│  · Release | 3.0.1 Jackson 호환 Hotfix | 진행중 | 진행 중 | BE  [수정][삭제] │
│  · MCP     | Tool 호출 불가 원인 점검   | 대기   | 확인 필요 | BE [수정][삭제]│
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 User Flow

```
회의록 탭 진입 → GET /api/meetings → 목록 렌더링
  ├─ DateNavigator로 날짜 선택 → "회의록 생성" → POST /api/meetings → 목록에 추가, 상세로 자동 진입(선택)
  ├─ 목록 항목 클릭 → GET /api/meetings/:id → 상세 화면(3섹션) 렌더링
  ├─ 각 섹션: 입력 폼으로 추가 → 목록에 즉시 반영(재조회)
  ├─ 각 섹션 항목: [수정] 클릭 → 인라인 편집 폼으로 전환(LongGoals 패턴) → 저장/취소
  ├─ 각 섹션 항목: [삭제] 클릭 → 즉시 삭제(섹션 항목은 파괴적이지 않아 확인 다이얼로그 생략, 회의록 자체 삭제만 확인 다이얼로그 적용)
  ├─ 액션아이템: 원문 텍스트박스에 붙여넣기 → "AI로 자동생성" 클릭 → 로딩 표시 → 성공 시 목록 하단에 추가된 항목들 표시 / 실패 시 에러 메시지, 원문은 유지(재시도 가능)
  └─ [◀ 목록으로] → 목록 화면 복귀 (선택 해제)
```

### 6.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `MeetingMinutes.jsx` | `client/src/components/MeetingMinutes/` | 목록/상세 상태 전환, `DateNavigator` 재사용, 3섹션 렌더 + 인라인 편집 폼(LongGoals 패턴), AI 생성 버튼/로딩/에러 처리 |
| `useMeetings` | `client/src/hooks/` | 목록/상세 로드 + 전체 액션(회의록/섹션 CRUD, `generateActionItems`) |

> Option A 선택에 따라 섹션별 컴포넌트를 분리하지 않는다 — `LongGoals.jsx`처럼 한 파일 안에서 섹션마다 리스트 렌더 블록 + 폼 상태를 반복한다.

### 6.4 Page UI Checklist

#### 회의록 탭 — 목록 화면

- [ ] 상단에 `DateNavigator` 재사용(◀ 날짜 ▶) + "이 날짜로 회의록 생성" 버튼
- [ ] 회의록 목록(날짜 최신순), 항목 없을 때 안내 문구
- [ ] 목록 항목 클릭 시 상세 화면으로 전환
- [ ] 목록 항목마다 삭제 버튼 → 커스텀 확인 다이얼로그(기존 `UnconsciousWorries` 패턴) → 확인 시 삭제

#### 회의록 탭 — 상세 화면 (공통)

- [ ] "◀ 목록으로" 버튼으로 목록 복귀
- [ ] 선택된 회의록의 날짜를 헤더로 표시

#### 상세 — "전체" 섹션

- [ ] 구분(공유/요청/진행프로젝트) select + 내용 input + "추가" 버튼
- [ ] 항목 리스트: 구분 배지 + 내용, [수정]/[삭제] 버튼
- [ ] [수정] 클릭 시 인라인 편집 폼(구분 select + 내용 input) + 저장/취소

#### 상세 — "파트별" 섹션

- [ ] 담당자(필수) + 진행사항 + 요청사항 input들 + "추가" 버튼
- [ ] 항목 리스트: 담당자 강조 표시 + 진행사항/요청사항, [수정]/[삭제] 버튼
- [ ] [수정] 클릭 시 인라인 편집 폼(3필드) + 저장/취소

#### 상세 — "액션아이템" 섹션

- [ ] 회의 원문 붙여넣기용 `textarea` + "AI로 자동생성" 버튼 (원문 공백이면 비활성화)
- [ ] AI 호출 중 로딩 상태 표시, 버튼 비활성화(중복 클릭 방지)
- [ ] AI 호출 실패 시 에러 메시지 표시, 원문 텍스트는 유지
- [ ] 수동 추가용 업무구분/내용/상태(select)/기한/담당자 input들 + "추가" 버튼
- [ ] 항목 리스트: 업무구분/내용/상태 배지/기한/담당자 표시, [수정]/[삭제] 버튼
- [ ] [수정] 클릭 시 인라인 편집 폼(5필드, 상태는 select) + 저장/취소

---

## 7. Error Handling

### 7.1 Error Code Definition

기존 `longgoals.js`와 동일하게 `{ error: string }` 포맷과 `handleRoute` 래퍼(§5.4의 async 대응 버전)를 사용한다.

| Status | 상황 | 메시지 |
|--------|------|--------|
| 400 | 날짜/내용/담당자 공백, 올바르지 않은 `status`/`kind` | `회의 날짜를 입력해주세요.` 등 필드별 메시지 |
| 404 | 존재하지 않는 회의록/섹션 항목 id | `회의록을 찾을 수 없습니다.` / `항목을 찾을 수 없습니다.` |
| 500 | `MEETING_AI_API_KEY`/`MEETING_AI_API_URL` 미설정 | `AI 기능이 설정되지 않았습니다. 서버 관리자에게 문의해주세요.` |
| 502 | 외부 AI API 호출 실패/타임아웃/비정상 응답 | `AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요.` |
| 500 | 그 외 예상 못한 서버 오류 | 기존 `index.js` 공통 에러 핸들러가 처리 |

### 7.2 Error Response Format

```json
{ "error": "회의록을 찾을 수 없습니다." }
```

AI 호출 실패 시에도 외부 API의 원본 에러 메시지나 상태 코드, 요청 헤더 등은 클라이언트에 그대로 전달하지 않는다(내부 구현/키 존재 여부 추정 방지).

---

## 8. Security Considerations

- **API 키 격리**: `MEETING_AI_API_KEY`는 서버 프로세스 환경변수로만 존재하며, 어떤 API 응답에도 포함되지 않는다. 클라이언트 번들에도 포함되지 않는다(서버 전용 `process.env` 접근이므로 Vite 빌드에 노출될 경로 자체가 없음).
- **로그 노출 금지**: `services/meetingAi.js`에서 요청/응답을 `console.error`로 남길 경우, 헤더(Authorization) 전체를 로깅하지 않는다.
- **비밀 값 문서화 금지**: 이 Design 문서, 커밋 메시지, 코드 주석 어디에도 실제 키 값을 기록하지 않는다 — `server/.env.example`은 키 이름만 포함한다.
- **입력 검증**: `date`/`content`/`assignee`는 trim 후 빈 문자열 검사, XSS는 React 기본 이스케이프에 의존(기존과 동일).
- **SQL Injection**: 기존과 동일하게 `db.prepare().run(...)` 파라미터 바인딩만 사용.
- **AI 프롬프트 인젝션**: 사용자가 붙여넣는 원문에 프롬프트를 조작하는 문구가 섞여도, 서버는 AI 응답을 `content`/`status`/`due_date`/`assignee` 필드로만 파싱해 DB에 저장하므로(임의 SQL/코드 실행 경로 없음) 영향 범위는 "부정확한 액션아이템 텍스트 생성" 수준으로 제한된다.
- **Rate Limiting**: 해당 없음(localhost 단일 사용자). 다만 외부 API 과금 관점에서, AI 생성 버튼은 클릭당 1회 호출만 발생하도록 로딩 중 중복 클릭을 막는다(§6.4).

---

## 9. Test Plan

### 9.1 Test Scope

자동화 테스트 도구가 설치되어 있지 않으므로 **수동 시나리오 검증**으로 대체한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API 확인 | 14개 엔드포인트 — 상태 코드/응답 형태 | `curl` 수동 실행 | Do |
| L2: UI 동작 확인 | §6.4 체크리스트 요소 | 브라우저 수동 조작 | Do |
| L3: E2E 시나리오 | 생성→3섹션 CRUD→AI 생성→삭제→새로고침 유지 | 브라우저 수동 조작 | Do/Check |

### 9.2 L1: API Test Scenarios

| # | Endpoint | Method | 설명 | 기대 상태 | 기대 응답 |
|---|----------|--------|------|:--------:|-----------|
| 1 | `/api/meetings` | GET | 빈 상태 조회 | 200 | `[]` |
| 2 | `/api/meetings` | POST | 날짜 없이 생성 시도 | 400 | `.error` 존재 |
| 3 | `/api/meetings` | POST | 정상 생성 | 201 | `.id` 존재 |
| 4 | `/api/meetings/:id` | GET | 상세 조회 | 200 | `.overall_items`/`.part_items`/`.action_items`가 배열 |
| 5 | `/api/meetings/:id/overall-items` | POST | 내용 없이 시도 | 400 | `.error` 존재 |
| 6 | `/api/meetings/:id/overall-items` | POST | 정상 생성 | 201 | `.kind === 'share'`(기본값) |
| 7 | `/api/meetings/:id/part-items` | POST | 담당자 없이 시도 | 400 | `.error` 존재 |
| 8 | `/api/meetings/:id/action-items` | POST | 잘못된 `status`로 시도 | 400 | `.error` 존재 |
| 9 | `/api/meetings/:id/action-items/generate` | POST | 원문 없이 시도 | 400 | `.error` 존재 |
| 10 | `/api/meetings/:id/action-items/generate` | POST | `MEETING_AI_API_KEY` 미설정 상태에서 시도 | 500 | `.error` 존재 |
| 11 | `/api/meetings/:id/action-items/generate` | POST | 키 설정 후 정상 원문으로 시도 | 201 | 배열, 각 항목 `.status`가 3개 값 중 하나 |
| 12 | `/api/meetings/overall-items/:id` | DELETE | 삭제 | 204 | 이후 상세 조회에서 부재 |
| 13 | `/api/meetings/:id` | DELETE | 회의록 삭제 | 204 | 이후 섹션 항목도 모두 조회 불가(CASCADE) |
| 14 | `/api/meetings/:id` | GET | 존재하지 않는 id 조회 | 404 | `.error` 존재 |

### 9.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | 목록 화면 | 날짜 선택 후 "회의록 생성" | 목록에 새 항목 표시 | `POST /api/meetings` 호출 확인 |
| 2 | 목록 화면 | 항목 클릭 | 상세 화면으로 전환, 3섹션 렌더 | `GET /api/meetings/:id` 응답과 화면 일치 |
| 3 | 상세 — 전체 섹션 | 항목 추가/수정/삭제 | 목록 즉시 갱신 | 각 CRUD 호출 확인 |
| 4 | 상세 — 파트별 섹션 | 항목 추가/수정/삭제 | 목록 즉시 갱신 | 각 CRUD 호출 확인 |
| 5 | 상세 — 액션아이템 섹션 | 수동 추가/수정/삭제 | 목록 즉시 갱신 | 각 CRUD 호출 확인 |
| 6 | 상세 — 액션아이템 섹션 | 원문 붙여넣기 → "AI로 자동생성" | 로딩 후 새 항목들이 목록에 추가 | `POST .../generate` 호출 및 응답 개수만큼 목록 증가 확인 |
| 7 | 상세 — 액션아이템 섹션 | AI 호출 실패(키 제거 등) 시도 | 에러 메시지 표시, 원문 유지 | 콘솔/네트워크에서 500/502 확인 |
| 8 | 목록 화면 | 회의록 삭제(확인 다이얼로그) | 목록에서 사라짐 | `DELETE /api/meetings/:id` 확인 |

### 9.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 생성→입력→새로고침 유지 | 회의록 생성 → 3섹션 각 2개 항목 추가 → 새로고침 | 모든 항목이 그대로 유지 |
| 2 | AI 생성 후 수동 편집 | 원문으로 AI 생성 → 생성된 항목의 상태/기한을 수동으로 수정 | 수정 내용이 저장되고 새로고침 후에도 유지 |
| 3 | 회의록 삭제 시 하위 데이터 제거 | 회의록에 3섹션 데이터 입력 → 회의록 삭제 → 목록/DB 확인 | 섹션 데이터가 모두 함께 삭제됨(고아 레코드 없음) |

### 9.5 Seed Data Requirements

없음 — Do/Check 단계에서 수동으로 회의록 1~2건, 섹션별 항목 2~3개를 생성해 검증한다. AI 생성 테스트는 실제 `MEETING_AI_API_KEY`가 로컬 `.env`에 설정된 상태에서 수행한다(팀 공용 키를 저장소에 커밋하지 않음에 유의).

---

## 10. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다.

### 10.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/폼 상태 처리 | `client/src/components/MeetingMinutes/MeetingMinutes.jsx` |
| **Application (Hook)** | 목록/상세 상태 로드 + 모든 액션 오케스트레이션 | `client/src/hooks/useMeetings.js` |
| **Infrastructure** | HTTP 통신, DB 접근, 외부 LLM 호출 | `client/src/api/meetings.js`, `server/routes/meetings.js`, `server/services/meetingAi.js` |
| **Domain** | 회의록/섹션 항목 shape (§3.1) | 별도 타입 파일 없이 JSDoc으로 문서화 (순수 JS 프로젝트) |

### 10.2 Dependency Rules

```
컴포넌트(Presentation) ──▶ 훅(Application) ──▶ api 모듈(Infrastructure) ──▶ fetch
                                                            │
서버: 라우트(Infrastructure) ──▶ services/meetingAi(Infrastructure) ──▶ 외부 LLM API
훅은 컴포넌트를 import하지 않는다 (단방향, 기존 useLongGoals와 동일한 규칙)
```

### 10.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `MeetingMinutes.jsx` | Presentation | `client/src/components/MeetingMinutes/` |
| `useMeetings` | Application | `client/src/hooks/useMeetings.js` |
| `api/meetings.js` | Infrastructure | `client/src/api/meetings.js` |
| `routes/meetings.js` | Infrastructure | `server/routes/meetings.js` |
| `services/meetingAi.js` | Infrastructure | `server/services/meetingAi.js` |

---

## 11. Coding Convention Reference

### 11.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다: 컴포넌트 PascalCase, 훅 `useXxx` camelCase, 함수 camelCase, DB 테이블/컬럼은 `meeting` 접두사 + snake_case.

### 11.2 Import Order

기존 파일 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다.

### 11.3 Environment Variables

신규 환경변수 3개(§5.5) 추가 — `MEETING_AI_API_URL`, `MEETING_AI_API_KEY`, `MEETING_AI_MODEL`. 최초로 서버에 비밀 값(secret)이 도입되므로 `dotenv`를 신규 의존성으로 추가한다(기존 `PORT`/`DB_PATH`는 계속 프로세스 환경변수 직접 참조 방식 유지, 충돌 없음).

### 11.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 리소스당 파일 수 | 라우트 1파일(`meetings.js`)에 회의록/3섹션 전체 CRUD + AI 생성, `longgoals.js`와 동일 |
| UI 파일 구조 | 컴포넌트 1파일(`MeetingMinutes.jsx`)에 목록+상세+3섹션, `LongGoals.jsx`와 동일 |
| 갱신 방식 | 부분 갱신은 `PATCH`, 목록/상세 조회는 `GET` — 기존과 동일 |
| 외부 API 호출 | 별도 서비스 모듈(`services/meetingAi.js`)로 분리, `services/notifications.js`와 동일 패턴 |
| 상태 관리 | 로컬 React state + custom hook(`reloadAfter` 패턴), 전역 스토어 도입 안 함 |
| 에러 처리 | `{ error: string }` 한국어 메시지 + `handleRoute`(async 대응 버전, §5.4) |
| 확인 다이얼로그 | 회의록 삭제에만 적용(파괴적 조작) — 섹션 항목 삭제는 되돌리기 쉬운 조작으로 간주해 즉시 삭제(기존 `long_goal_requirements` 등과 동일 수준) |
| 비밀 값 관리 | `.env`(gitignored) + `dotenv` 로드, `.env.example`로 키 이름만 문서화, 코드/문서/커밋에 실제 값 기록 금지 |

---

## 12. Implementation Guide

### 12.1 File Structure

```
server/
├── db/schema.sql                          (수정 — meetings/meeting_overall_items/meeting_part_items/meeting_action_items 테이블 추가)
├── services/meetingAi.js                  (신규 — 외부 LLM 호출 + 응답 파싱)
├── routes/meetings.js                     (신규 — 회의록/섹션 CRUD 13개 + AI 생성 1개 엔드포인트)
├── index.js                               (수정 — dotenv 로드 + app.use('/api/meetings', ...) 등록)
├── package.json                           (수정 — dotenv 의존성 추가)
└── .env.example                           (신규 — MEETING_AI_* 키 이름만 문서화)

client/src/
├── api/meetings.js                        (신규 — fetchMeetings, createMeeting, deleteMeeting, fetchMeetingDetail,
│                                            add/update/deleteOverallItem, add/update/deletePartItem,
│                                            add/update/deleteActionItem, generateActionItems)
├── hooks/useMeetings.js                   (신규 — 목록/상세 상태 + 위 액션 전체 래핑)
├── components/MeetingMinutes/
│   └── MeetingMinutes.jsx                 (신규 — 목록/상세 컨테이너 + 3섹션 인라인 편집)
└── App.jsx                                (수정 — TABS에 { id: 'meetings', label: '회의록' } 추가, 탭 렌더 분기 1개)
```

### 12.2 Implementation Order

1. [ ] `server/db/schema.sql` — 4개 테이블 추가
2. [ ] `server/package.json` — `dotenv` 추가, `server/.env.example` 작성
3. [ ] `server/index.js` — 최상단에 `require('dotenv').config()` 추가
4. [ ] `server/services/meetingAi.js` — 프롬프트 구성, 외부 호출, 파싱/폴백 구현
5. [ ] `server/routes/meetings.js` — async 대응 `handleRoute` + 14개 엔드포인트 구현 (`longgoals.js` 헬퍼 패턴 재사용)
6. [ ] `server/index.js` — `app.use('/api/meetings', require('./routes/meetings'))` 등록
7. [ ] `client/src/api/meetings.js` — fetch 래퍼 함수들
8. [ ] `client/src/hooks/useMeetings.js` — 상태 로드 + 액션(AI 생성 로딩/에러 상태 포함)
9. [ ] `client/src/components/MeetingMinutes/MeetingMinutes.jsx` — 목록/상세 + 3섹션 + AI 생성 UI
10. [ ] `client/src/App.jsx` — `TABS`에 탭 추가, 렌더 분기 추가
11. [ ] 로컬 `server/.env`에 실제 `MEETING_AI_API_KEY`/`MEETING_AI_API_URL` 설정(재발급된 키 사용 권장) 후 §9.2~9.4 수동 시나리오 검증

### 12.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---:|
| 백엔드 — 스키마/설정 | `module-1` | `schema.sql`, `dotenv` 설정, `.env.example` | 4-6 |
| 백엔드 — AI 서비스 | `module-2` | `services/meetingAi.js` | 6-8 |
| 백엔드 — API 라우트 | `module-3` | `routes/meetings.js`, `index.js` 등록 | 10-12 |
| 클라이언트 데이터층 | `module-4` | `api/meetings.js`, `useMeetings.js` | 8-10 |
| 클라이언트 UI | `module-5` | `MeetingMinutes.jsx`(목록+상세+3섹션+AI), `App.jsx` 탭 추가 | 15-18 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 (본 문서) |
| Session 2 | Do | `--scope module-1,module-2,module-3` | 20-25 |
| Session 3 | Do | `--scope module-4,module-5` | 22-26 |
| Session 4 | Check + Report | 전체 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-01 | Initial draft (Option A 선택, 액션아이템 AI 자동생성 서버사이드 격리 설계 포함) | Mincoln Cho |
