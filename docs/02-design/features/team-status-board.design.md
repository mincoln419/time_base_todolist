---
template: design
version: 1.3
---

# team-status-board Design Document

> **Summary**: 인원을 상단 로스터에 등록하고 하단 업무/프로젝트 레일로 드래그 배치하는 "업무 배치 보드" 탭의 설계 — 기존 `long_goals`/`tasks` 리소스 컨벤션(단일 라우트 파일, 결합 GET, PATCH 갱신)과 `TaskBacklog`류 DnD 패턴을 그대로 재사용한다
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-28
> **Status**: Draft
> **Planning Doc**: [team-status-board.plan.md](../../01-plan/features/team-status-board.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline(schema.md/conventions.md 등)을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 팀원별 업무 배치/진행 상황을 파악할 화면이 없어 매번 별도로 확인해야 함 |
| **WHO** | 이 앱을 쓰는 사용자 — 팀원들의 업무 배치를 관리하는 사람(매니저/리드) |
| **RISK** | "인원 카드 1개 = 위치 1개" 구조라 다중 업무 배치를 태그로만 표현 — 물리적 다중 배치처럼 보이진 않음 |
| **SUCCESS** | +버튼으로 인원 추가 → 레일로 드래그 배치 → 레일 간 이동/로스터 복귀 → 새로고침 후에도 유지 |
| **SCOPE** | (1) 3개 신규 테이블(rails/members/member_tasks) (2) `/api/warroom` REST API (3) 상단 로스터 + 하단 레일 보드 UI (4) 카드 내 업무 태그 CRUD (5) 새 탭 등록 |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 1. Overview

### 1.1 Design Goals

- 인원(멤버) 카드를 로스터 ↔ 레일 사이로 드래그해 배치 상태를 즉시 서버에 반영한다.
- 레일(업무/프로젝트)과 인원 카드 내부의 업무 태그를 모두 사용자가 자유롭게 추가/수정/삭제할 수 있게 한다.
- `long_goals` 기능에서 이미 확립된 컨벤션(단일 라우트 파일 + 결합 GET + `PATCH` 부분 갱신 + `reloadAfter` 훅 패턴)과 `TaskBacklog`의 DnD 패턴(드롭 가능한 로스터 + `useDraggable` 카드)을 그대로 재사용해 새 컨벤션을 만들지 않는다.

### 1.2 Design Principles

- **컨벤션 재사용 우선**: 새 라우트 파일(`warroom.js`)은 `longgoals.js`의 `handleRoute`/`assertX`/`maxPosition` 헬퍼 패턴을 그대로 따른다. 새 훅(`useWarRoom`)은 `useLongGoals`의 "액션 후 전체 재조회(`reloadAfter`)" 패턴을 그대로 따른다.
- **DnD 격리**: `App.jsx`의 기존 `DndContext`(스케줄 탭 전용)를 확장하지 않고, `WarRoomBoard.jsx` 내부에 독립된 `DndContext`를 둔다. 탭 전환 시에만 마운트되므로 두 컨텍스트가 동시에 활성화되지 않는다.
- **단순함 우선**: 인증, 페이지네이션, 실시간 동기화, 낙관적 업데이트(optimistic update)를 도입하지 않는다 — 서버 액션 후 전체 재조회로 항상 최신 상태를 반영한다(로컬 단일 사용자 앱 규모에서 충분).

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal (컨벤션 그대로 재사용) | Option B: Clean (레일/멤버 훅 분리) | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | `long_goals`와 동일하게 라우트 1파일 + 훅 1개(`useWarRoom`)에 전체 CRUD 결합 | 레일용 훅과 멤버용 훅을 분리 | 훅은 하나로 결합하되 컴포넌트만 세분화 |
| **New Files** | 6 (route, api, hook, board/roster/card/rail 컴포넌트 4개) | 8 (훅 분리로 +1, 컴포넌트 동일) | 6 |
| **Modified Files** | 2 (`schema.sql`, `App.jsx`) | 2 | 2 |
| **Complexity** | Low | Medium | Low |
| **Maintainability** | High (기존 `long_goals`와 동일한 형태라 유지보수자가 이미 아는 패턴) | Medium (분리 기준이 애매 — 레일/멤버가 항상 같이 렌더링됨) | High |
| **Effort** | Low | Medium | Low |
| **Risk** | Low | Low | Low |
| **Recommendation** | **Default choice** | 데이터가 더 커지면 고려 | Option A와 사실상 동일 |

**Selected**: **Option A — Minimal, `long_goals` 컨벤션 그대로 재사용**
**Rationale**: 레일과 멤버는 한 화면에서 항상 함께 렌더링되고 갱신 시점(드래그 배치, 추가/삭제)도 거의 항상 같이 일어나므로, `useLongGoals`처럼 훅 하나가 전체 보드 상태(rails + members + tasks)를 들고 있는 편이 자연스럽다. 이 프로젝트 규모에서 훅을 분리할 실익이 없다.

> 아래 상세 설계는 Option A를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌──────────────┐      ┌─────────────────────────────┐      ┌────────────────────────┐
│ WarRoomBoard │─────▶│ Express /api/warroom routes  │─────▶│ SQLite                  │
│ 탭 (SPA)     │◀─────│ (GET / POST / PATCH / DELETE)│◀─────│ warroom_rails           │
└──────┬───────┘      └─────────────────────────────┘      │ warroom_members         │
       │                                                     │ warroom_member_tasks    │
       │ (독립 DndContext)                                    └────────────────────────┘
       ├─ MemberRoster (droppable: 'roster')
       ├─ Rail × N (droppable: `rail-{id}`)
       └─ MemberCard × N (draggable: `member-{id}`)
```

### 2.2 Data Flow

```
탭 진입 → useWarRoom()이 GET /api/warroom 호출 → { rails, members(+tasks) } 로드
  → 인원 추가: 상단 입력창에 이름 입력 → POST /members → 전체 재조회 (rail_id=NULL이라 로스터에 표시)
  → 레일 추가: 하단 입력창에 이름 입력 → POST /rails → 전체 재조회
  → 드래그 종료(onDragEnd):
      over.id === 'roster'  → PATCH /members/:id { rail_id: null } → 재조회
      over.id === 'rail-N'  → PATCH /members/:id { rail_id: N }    → 재조회
  → 업무 태그 추가: 카드 내 입력창 → POST /members/:id/tasks { title } → 재조회
  → 주요 업무 지정: 태그 클릭(★) → PATCH /member-tasks/:id { is_primary: true } → 서버가 같은 멤버의 다른 태그 is_primary를 0으로 정리 → 재조회
  → 태그/카드/레일 삭제: 확인 다이얼로그 → DELETE 호출 → 재조회
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `WarRoomBoard.jsx` | `useWarRoom`, `DndContext`(자체) | 로스터+레일 레이아웃 컨테이너, 드래그 종료 시 배치 갱신 오케스트레이션 |
| `MemberRoster.jsx` | (props만 수신) | 미배치 인원 표시(드롭 대상 `'roster'`) + 인원 추가 입력창 |
| `Rail.jsx` | (props만 수신) | 레일 1개 표시(드롭 대상 `` `rail-${id}` ``) + 이름 수정/삭제 |
| `MemberCard.jsx` | (props만 수신) | 드래그 가능한 인원 카드 + 업무 태그 추가/주요지정/삭제 + 카드 삭제 |
| `useWarRoom.js` | `api/warroom.js` | 보드 전체 상태 로드 + 모든 액션(레일/멤버/태그 CRUD, 배치 이동) |

---

## 3. Data Model

### 3.1 Entity Definition

```
WarRoomRail
{
  id: number,
  name: string,
  position: number,
  created_at: string,
}

WarRoomMember
{
  id: number,
  name: string,
  rail_id: number | null,   // null = 미배치(로스터에 표시)
  position: number,
  created_at: string,
  tasks: WarRoomMemberTask[],  // GET /api/warroom 응답에서 중첩 포함
}

WarRoomMemberTask
{
  id: number,
  member_id: number,
  title: string,
  is_primary: 0 | 1,
  position: number,
  created_at: string,
}
```

### 3.2 Entity Relationships

```
[warroom_rails] 1 ──── N [warroom_members]   (rail_id, ON DELETE SET NULL — 레일 삭제 시 인원은 로스터로 복귀)
[warroom_members] 1 ──── N [warroom_member_tasks]  (member_id, ON DELETE CASCADE — 인원 삭제 시 태그도 함께 삭제)
```

### 3.3 Database Schema

`server/db/schema.sql`에 아래 3개 테이블을 추가한다 (기존 테이블 무변경):

```sql
-- 업무 배치 보드: 레일(업무/프로젝트 단위) — 하단에 addable
CREATE TABLE IF NOT EXISTS warroom_rails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 업무 배치 보드: 인원 카드 (rail_id NULL = 미배치, 상단 로스터에 표시)
CREATE TABLE IF NOT EXISTS warroom_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  rail_id    INTEGER REFERENCES warroom_rails(id) ON DELETE SET NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 인원별 매핑된 업무 태그 (여러 개 가능, is_primary=1인 태그는 멤버당 최대 1개)
CREATE TABLE IF NOT EXISTS warroom_member_tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL REFERENCES warroom_members(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

> `database.js`는 `PRAGMA foreign_keys = ON`을 이미 켜두고 있으므로(`server/db/database.js`) `ON DELETE SET NULL`/`ON DELETE CASCADE`가 그대로 동작한다. 별도 마이그레이션 가드 불필요 — 새 테이블이므로 `CREATE TABLE IF NOT EXISTS`만으로 충분하다(기존 `focus_map`처럼 구조 변경/DROP이 필요한 경우가 아님).

---

## 4. API Specification

### 4.1 Endpoint List

라우트 파일 1개(`server/routes/warroom.js`)에 전체 CRUD를 모으고 `/api/warroom`에 마운트한다 (`long_goals`와 동일한 형태).

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/warroom` | 전체 보드(rails + members(+tasks 중첩)) 조회 | 없음 |
| POST | `/api/warroom/rails` | 레일 생성 | 없음 |
| PATCH | `/api/warroom/rails/:id` | 레일 이름 수정 | 없음 |
| DELETE | `/api/warroom/rails/:id` | 레일 삭제 (소속 인원은 자동으로 `rail_id=NULL`) | 없음 |
| POST | `/api/warroom/members` | 인원 생성 (`rail_id=NULL`로 시작) | 없음 |
| PATCH | `/api/warroom/members/:id` | 인원의 `rail_id` 갱신 (드래그 배치/이동/미배치 복귀에 사용) | 없음 |
| DELETE | `/api/warroom/members/:id` | 인원 삭제 (태그 CASCADE 삭제) | 없음 |
| POST | `/api/warroom/members/:id/tasks` | 인원에 업무 태그 추가 | 없음 |
| PATCH | `/api/warroom/member-tasks/:id` | 업무 태그의 `is_primary` 갱신 (지정 시 같은 인원의 다른 태그는 서버가 0으로 정리) | 없음 |
| DELETE | `/api/warroom/member-tasks/:id` | 업무 태그 삭제 | 없음 |

### 4.2 Detailed Specification

#### `GET /api/warroom`

**Response (200):**
```json
{
  "rails": [
    { "id": 1, "name": "프로젝트 A", "position": 0, "created_at": "2026-08-28 09:00:00" }
  ],
  "members": [
    {
      "id": 5, "name": "김철수", "rail_id": 1, "position": 0, "created_at": "2026-08-28 09:01:00",
      "tasks": [
        { "id": 11, "member_id": 5, "title": "결제 모듈 리팩터링", "is_primary": 1, "position": 0 },
        { "id": 12, "member_id": 5, "title": "코드리뷰", "is_primary": 0, "position": 1 }
      ]
    },
    { "id": 6, "name": "이영희", "rail_id": null, "position": 1, "created_at": "2026-08-28 09:02:00", "tasks": [] }
  ]
}
```

#### `POST /api/warroom/rails`

**Request:** `{ "name": "프로젝트 A" }`
**Response (201)**: 생성된 레일 객체
**Error**: `400` — 이름 공백: `{ "error": "레일 이름을 입력해주세요." }`

#### `PATCH /api/warroom/rails/:id`

**Request:** `{ "name": "프로젝트 A-1" }`
**Response (200)**: 갱신된 레일 객체
**Error**: `404` — 존재하지 않는 id

#### `DELETE /api/warroom/rails/:id`

**Response**: `204 No Content` (부수효과: 해당 레일의 인원들은 `rail_id=NULL`로 자동 갱신됨 — FK `ON DELETE SET NULL`)
**Error**: `404`

#### `POST /api/warroom/members`

**Request:** `{ "name": "김철수" }`
**Response (201)**: 생성된 인원 객체 (`rail_id: null`, `tasks: []`)
**Error**: `400` — 이름 공백: `{ "error": "이름을 입력해주세요." }`

#### `PATCH /api/warroom/members/:id`

**Request:** `{ "rail_id": 1 }` 또는 `{ "rail_id": null }` (미배치 복귀)
**Response (200)**: 갱신된 인원 객체
**Error**: `404` — 존재하지 않는 인원, 또는 `rail_id`가 존재하지 않는 레일을 가리킬 때: `{ "error": "레일을 찾을 수 없습니다." }` (기존 `assertGoal`류 헬퍼와 동일하게 404로 통일)

#### `DELETE /api/warroom/members/:id`

**Response**: `204 No Content`
**Error**: `404`

#### `POST /api/warroom/members/:id/tasks`

**Request:** `{ "title": "코드리뷰" }`
**Response (201)**: 생성된 태그 객체 (`is_primary: 0`)
**Error**: `400` — 이름 공백, `404` — 존재하지 않는 인원

#### `PATCH /api/warroom/member-tasks/:id`

**Request:** `{ "is_primary": true }`
**Response (200)**: 갱신된 태그 객체 — 서버는 같은 `member_id`의 다른 태그를 `is_primary=0`으로 함께 갱신(단일 트랜잭션)
**Error**: `404`

#### `DELETE /api/warroom/member-tasks/:id`

**Response**: `204 No Content`
**Error**: `404`

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [일정관리][포커스 맵][고객사 티켓][캘린더][고민목록][장기목표][업무 배치 보드]│ ← App.jsx 상단 탭 (신규 탭 1개 추가)
├──────────────────────────────────────────────────────────────────────┤
│ 미배치 인원                                                             │
│ ┌──────────────────────────────────────────────────────────────┐ │  ← MemberRoster (droppable: 'roster')
│ │ [이영희]  [박민수]                                                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [ 이름 입력_______________ ] [+ 인원 추가]                              │
│                                                                        │
│ 프로젝트 A                                            [이름수정][삭제]   │  ← Rail (droppable: 'rail-1')
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ [김철수 ★결제 모듈 리팩터링 · 코드리뷰 ✕]                          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ 프로젝트 B                                            [이름수정][삭제]   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ (배치된 인원 없음)                                                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ [ 레일 이름 입력_______________ ] [+ 레일 추가]                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 User Flow

```
업무 배치 보드 탭 진입 → GET /api/warroom → 로스터 + 레일 렌더링
  ├─ "+ 인원 추가" → 로스터에 새 카드(미배치) 즉시 추가
  ├─ "+ 레일 추가" → 하단에 새 레일 즉시 추가
  ├─ 로스터의 카드를 레일로 드래그 → 그 레일 소속으로 이동
  ├─ 레일 간 카드 드래그 → 소속 레일 변경
  ├─ 배치된 카드를 로스터로 드래그 → 미배치 상태로 복귀
  ├─ 카드 내 업무 태그 추가/삭제, ★클릭으로 주요 업무 지정
  ├─ 레일 이름 수정(인라인) / 레일 삭제(확인 다이얼로그 → 소속 인원은 로스터로 복귀)
  └─ 카드 삭제(확인 다이얼로그 → 태그도 함께 삭제)
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `WarRoomBoard.jsx` | `client/src/components/WarRoomBoard/` | 자체 `DndContext` 보유, 로스터+레일 레이아웃, `onDragEnd`에서 배치 갱신 호출 |
| `MemberRoster.jsx` | `client/src/components/WarRoomBoard/` | 미배치 인원 표시(드롭 대상) + 인원 추가 입력창 |
| `Rail.jsx` | `client/src/components/WarRoomBoard/` | 레일 1개(드롭 대상) + 배치된 카드 목록 + 이름 수정/삭제 |
| `MemberCard.jsx` | `client/src/components/WarRoomBoard/` | 드래그 가능한 카드 + 업무 태그 추가/주요지정/삭제 + 카드 삭제 |
| `useWarRoom` | `client/src/hooks/` | 보드 상태 로드 + 전체 액션 (레일/멤버/태그 CRUD, 배치 이동) |

### 5.4 Page UI Checklist

#### 업무 배치 보드 탭 — 로스터 (MemberRoster)

- [ ] 제목 "미배치 인원"
- [ ] 드롭 가능 영역(점선 테두리, 드래그 오버 시 강조) — `TaskBacklog`와 동일한 시각 패턴
- [ ] 인원 카드가 없을 때 안내 문구
- [ ] 하단에 이름 입력창 + "+ 인원 추가" 버튼 (Enter로도 제출)

#### 업무 배치 보드 탭 — 레일 (Rail, 반복)

- [ ] 레일 이름 표시, 클릭 시 인라인 입력창으로 전환해 수정 (Enter/blur 저장)
- [ ] 레일 삭제 버튼 → 커스텀 확인 다이얼로그(기존 `UnconsciousWorries`와 동일한 로컬 `confirmState` 패턴) → 확인 시 삭제
- [ ] 드롭 가능 영역 — 배치된 카드들을 가로 `flex-wrap`으로 표시, 빈 레일은 안내 문구
- [ ] 레일 목록 맨 끝에 이름 입력창 + "+ 레일 추가" 버튼

#### 업무 배치 보드 탭 — 인원 카드 (MemberCard)

- [ ] 이름 표시
- [ ] 업무 태그 칩 목록 — 주요 업무는 ★ 아이콘/강조 스타일로 구분
- [ ] 태그 칩 클릭 → 주요 업무로 지정 (`PATCH is_primary`)
- [ ] 태그 칩마다 개별 삭제(✕) 버튼
- [ ] 카드 내 작은 입력창으로 새 태그 추가
- [ ] 카드 삭제 버튼 → 확인 다이얼로그 → 확인 시 삭제
- [ ] 드래그 가능(`cursor-grab`), 버튼 클릭 시 `onPointerDown`에서 `stopPropagation`으로 드래그 오작동 방지 (`TaskItem`과 동일 패턴)

---

## 6. Error Handling

### 6.1 Error Code Definition

기존 `longgoals.js`/`tasks.js`와 동일하게 `{ error: string }` 포맷과 `handleRoute` 래퍼(에러에 `status`가 있으면 그 상태 코드로, 없으면 공통 500 핸들러로 위임)를 그대로 사용한다.

| Status | 상황 | 메시지 |
|--------|------|--------|
| 400 | 레일 이름/인원 이름/태그 제목 공백 | `레일 이름을 입력해주세요.` / `이름을 입력해주세요.` / `업무명을 입력해주세요.` |
| 404 | 존재하지 않는 레일/인원/태그 id로 조회·수정·삭제, 또는 `rail_id`가 존재하지 않는 레일을 가리킴 | `레일을 찾을 수 없습니다.` / `인원을 찾을 수 없습니다.` / `업무 태그를 찾을 수 없습니다.` |
| 500 | 예상 못한 서버 오류 | 기존 `index.js` 공통 에러 핸들러가 처리 (변경 없음) |

### 6.2 Error Response Format

```json
{ "error": "존재하지 않는 레일입니다." }
```

---

## 7. Security Considerations

로컬 단일 사용자 앱으로 외부 노출/인증이 없는 기존 구조를 그대로 유지한다.

- [ ] 입력 검증: `name`/`title`은 trim 후 빈 문자열 여부만 검사 (XSS는 React 기본 이스케이프에 의존, 기존과 동일)
- [ ] SQL Injection: 기존과 동일하게 `db.prepare().run(...)` 파라미터 바인딩만 사용, 문자열 concat 금지
- [ ] Rate Limiting / HTTPS: 해당 없음 (localhost 전용, 기존과 동일)

---

## 8. Test Plan

### 8.1 Test Scope

이 프로젝트는 자동화 테스트 도구가 설치되어 있지 않다. Do 단계에서도 자동 테스트 코드 대신 **수동 시나리오 검증**으로 대체한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API 확인 | 10개 엔드포인트 — 상태 코드/응답 형태 | `curl` 수동 실행 | Do |
| L2: UI 동작 확인 | §5.4 체크리스트 요소 | 브라우저 수동 조작 (claude-in-chrome 등) | Do |
| L3: E2E 시나리오 | 배치/이동/복귀, 태그 CRUD, 레일/인원 삭제, 새로고침 유지 | 브라우저 수동 조작 | Do/Check |

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | 설명 | 기대 상태 | 기대 응답 |
|---|----------|--------|------|:--------:|-----------|
| 1 | `/api/warroom` | GET | 빈 상태 조회 | 200 | `{ rails: [], members: [] }` |
| 2 | `/api/warroom/rails` | POST | 이름 없이 생성 시도 | 400 | `.error` 존재 |
| 3 | `/api/warroom/rails` | POST | 정상 생성 | 201 | `.id` 존재 |
| 4 | `/api/warroom/members` | POST | 정상 생성 | 201 | `.rail_id === null`, `.tasks`가 배열 |
| 5 | `/api/warroom/members/:id` | PATCH | 존재하는 레일로 배치 | 200 | `.rail_id`가 해당 레일 id |
| 6 | `/api/warroom/members/:id` | PATCH | 존재하지 않는 레일로 배치 시도 | 404 | `.error` 존재 |
| 7 | `/api/warroom/members/:id/tasks` | POST | 태그 추가 | 201 | `.is_primary === 0` |
| 8 | `/api/warroom/member-tasks/:id` | PATCH | `is_primary: true` 지정 | 200 | 같은 멤버의 다른 태그는 `is_primary === 0`으로 재확인 |
| 9 | `/api/warroom/rails/:id` | DELETE | 인원이 배치된 레일 삭제 | 204 | 이후 `GET /api/warroom`에서 그 인원의 `rail_id === null` |
| 10 | `/api/warroom/members/:id` | DELETE | 삭제 | 204 | 이후 `GET`에 해당 인원과 태그 모두 없음 |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | 업무 배치 보드 탭 | 로드 | 로스터 + 레일 목록 렌더링 | `GET /api/warroom` 응답과 화면 일치 |
| 2 | 로스터 | "+ 인원 추가" | 로스터에 새 카드 즉시 표시 | `POST /members` 호출 확인 |
| 3 | 레일 목록 | "+ 레일 추가" | 하단에 새 레일 즉시 표시 | `POST /rails` 호출 확인 |
| 4 | 카드 → 레일 | 드래그 앤 드롭 | 카드가 로스터에서 사라지고 레일 안에 표시 | `PATCH /members/:id { rail_id }` 호출 확인 |
| 5 | 레일 → 레일 | 드래그 앤 드롭 | 카드가 다른 레일로 이동 | `rail_id` 값 변경 확인 |
| 6 | 레일 → 로스터 | 드래그 앤 드롭 | 카드가 로스터로 복귀 | `rail_id: null` 확인 |
| 7 | 카드 | 업무 태그 추가/★지정/삭제 | 태그 목록/주요 표시가 즉시 갱신 | `GET /api/warroom` 응답 확인 |
| 8 | 레일 | 삭제(확인 다이얼로그 확인 클릭) | 레일 사라지고, 소속 인원은 로스터에 표시 | `rail_id: null` 확인 |
| 9 | 카드 | 삭제(확인 다이얼로그 확인 클릭) | 카드/태그 모두 사라짐 | `GET`에서 부재 확인 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 배치 후 새로고침 유지 | 인원 추가 → 레일 추가 → 드래그 배치 → 새로고침 | 배치 상태가 그대로 유지됨 |
| 2 | 레일 삭제 시 인원 보존 | 인원을 레일에 배치 → 레일 삭제 → 로스터 확인 | 인원이 삭제되지 않고 로스터에 나타남 |
| 3 | 다중 업무 태그 + 주요 업무 | 한 인원에 태그 3개 추가 → 그중 하나를 주요로 지정 → 다른 것 지정 | 항상 정확히 1개의 태그만 ★ 표시 |

### 8.5 Seed Data Requirements

없음 — Do/Check 단계에서 수동으로 인원 2~3명, 레일 2개를 생성해 검증한다.

---

## 9. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다.

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/드래그 이벤트 처리 | `client/src/components/WarRoomBoard/` |
| **Application (Hook)** | 보드 상태 로드 + 모든 액션 오케스트레이션 | `client/src/hooks/useWarRoom.js` |
| **Infrastructure** | HTTP 통신, DB 접근 | `client/src/api/warroom.js`, `server/routes/warroom.js` |
| **Domain** | 레일/인원/태그 shape (§3.1) | 별도 타입 파일 없이 JSDoc으로 문서화 (순수 JS 프로젝트) |

### 9.2 Dependency Rules

```
컴포넌트(Presentation) ──▶ 훅(Application) ──▶ api 모듈(Infrastructure) ──▶ fetch
훅은 컴포넌트를 import하지 않는다 (단방향, 기존 useLongGoals와 동일한 규칙)
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `WarRoomBoard.jsx` / `MemberRoster.jsx` / `Rail.jsx` / `MemberCard.jsx` | Presentation | `client/src/components/WarRoomBoard/` |
| `useWarRoom` | Application | `client/src/hooks/useWarRoom.js` |
| `api/warroom.js` | Infrastructure | `client/src/api/warroom.js` |
| `routes/warroom.js` | Infrastructure | `server/routes/warroom.js` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다: 컴포넌트 PascalCase, 훅 `useXxx` camelCase, 함수 camelCase, 폴더는 기능 단위 PascalCase(`WarRoomBoard/`). DB 테이블/컬럼은 `warroom_` 접두사 + snake_case.

### 10.2 Import Order

기존 파일 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다. 강제 ESLint/Prettier 설정 없음.

### 10.3 Environment Variables

신규 환경변수 없음 — 기존 `PORT`, `DB_PATH`를 재사용한다.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 리소스당 파일 수 | 라우트 1파일(`warroom.js`)에 레일/멤버/태그 전체 CRUD, `longgoals.js`와 동일 |
| 갱신 방식 | 부분 갱신은 `PATCH`, 전체 조회는 결합 `GET /` — `longgoals.js`와 동일 (Plan 문서의 `PUT` 표기는 Design 단계에서 실제 컨벤션에 맞춰 `PATCH`로 확정) |
| 상태 관리 | 로컬 React state + custom hook(`reloadAfter` 패턴), 전역 스토어 도입 안 함 |
| 에러 처리 | `{ error: string }` 한국어 메시지 + `handleRoute` 래퍼, 기존 라우트와 동일 |
| 확인 다이얼로그 | 공용 컴포넌트가 아직 없으므로(각 기능이 로컬 `confirmState`로 구현), `UnconsciousWorries.jsx`의 인라인 패턴을 `WarRoomBoard.jsx`에도 동일하게 복제해 구현 (공용 컴포넌트로 추출하는 리팩터링은 Out of Scope) |

---

## 11. Implementation Guide

### 11.1 File Structure

```
server/
├── db/schema.sql                          (수정 — warroom_rails/members/member_tasks 테이블 추가)
├── routes/warroom.js                      (신규 — 레일/멤버/태그 CRUD 10개 엔드포인트)
└── index.js                               (수정 — app.use('/api/warroom', ...) 등록)

client/src/
├── api/warroom.js                         (신규 — fetchBoard, createRail, renameRail, deleteRail,
│                                            createMember, moveMember, deleteMember,
│                                            addMemberTask, setPrimaryTask, deleteMemberTask)
├── hooks/useWarRoom.js                    (신규 — 보드 상태 + reloadAfter 패턴 액션들)
└── components/WarRoomBoard/
    ├── WarRoomBoard.jsx                   (신규 — DndContext + 레이아웃 컨테이너)
    ├── MemberRoster.jsx                   (신규 — 로스터 + 인원 추가)
    ├── Rail.jsx                           (신규 — 레일 1개 + 이름수정/삭제)
    └── MemberCard.jsx                     (신규 — 카드 + 업무 태그 CRUD + 카드 삭제)
```

### 11.2 Implementation Order

1. [ ] `server/db/schema.sql` — 3개 테이블 추가
2. [ ] `server/routes/warroom.js` — 10개 엔드포인트 구현 (`longgoals.js`의 `handleRoute`/`assertX`/`maxPosition` 헬퍼 재사용 또는 동일 패턴으로 재작성)
3. [ ] `server/index.js` — 라우트 등록
4. [ ] `client/src/api/warroom.js` — fetch 래퍼 함수들
5. [ ] `client/src/hooks/useWarRoom.js` — 상태 로드 + 액션
6. [ ] `client/src/components/WarRoomBoard/MemberCard.jsx` — 드래그 가능 카드 + 태그 CRUD
7. [ ] `client/src/components/WarRoomBoard/MemberRoster.jsx` — 로스터(드롭 대상) + 추가 입력창
8. [ ] `client/src/components/WarRoomBoard/Rail.jsx` — 레일(드롭 대상) + 이름수정/삭제
9. [ ] `client/src/components/WarRoomBoard/WarRoomBoard.jsx` — 컨테이너 + `DndContext`/`onDragEnd` + 레일 추가 입력창 + 삭제 확인 다이얼로그
10. [ ] `client/src/App.jsx` — `TABS`에 `{ id: 'warroom', label: '업무 배치 보드' }` 추가, 탭 렌더 분기 1개 추가
11. [ ] §8.2~8.4 수동 시나리오 검증

### 11.3 Session Guide

> Session 1(Plan+Design)은 본 문서로 완료. `/pdca do team-status-board --scope module-N`으로 모듈별 구현 가능.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---:|
| 백엔드 (스키마+API) | `module-1` | `schema.sql`, `routes/warroom.js`, `index.js` 라우트 등록 | 10-12 |
| 클라이언트 데이터층 | `module-2` | `api/warroom.js`, `useWarRoom.js` | 6-8 |
| UI — 카드/로스터/레일 | `module-3` | `MemberCard.jsx`, `MemberRoster.jsx`, `Rail.jsx` | 12-15 |
| UI — 보드 컨테이너 + 탭 등록 | `module-4` | `WarRoomBoard.jsx`(DnD/확인 다이얼로그), `App.jsx` 탭 추가 | 8-10 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 (본 문서) |
| Session 2 | Do | `--scope module-1,module-2` | 18-20 |
| Session 3 | Do | `--scope module-3,module-4` | 20-25 |
| Session 4 | Check + Report | 전체 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-28 | Initial draft (Option A 선택) | Mincoln Cho |
