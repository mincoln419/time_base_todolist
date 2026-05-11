# time-based-todolist Design Document

> **Summary**: SQLite + Express + React(Vite) 기반 시간 블록 일정관리 앱의 DB 스키마, API, 컴포넌트 설계
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: mgcho@ideatec.co.kr
> **Date**: 2026-05-11
> **Status**: Draft
> **Planning Doc**: [time-based-todolist.plan.md](../01-plan/features/time-based-todolist.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- SQLite 단일 파일로 로컬 영구 저장
- Express REST API — 엔드포인트 최소화
- DnD 상태를 React 단에서만 관리, 서버는 결과만 저장

### 1.2 Design Principles

- 백엔드는 순수 CRUD만 담당, 비즈니스 로직은 프론트엔드에 위치
- 컴포넌트는 DnD 역할(드래그 소스 / 드롭 대상)과 UI 역할을 분리
- 날짜별 스케줄 조회는 URL 파라미터(`:date`)로 표현

---

## 2. Architecture

### 2.1 컴포넌트 다이어그램

```
Browser (React + @dnd-kit)
  └── App.jsx  [selectedDate state]
        ├── DateNavigator       ← 날짜 이동
        ├── TaskBacklog         ← 백로그 목록 (DnD 소스)
        │     └── TaskItem[]    ← <Draggable>
        └── TimeGrid            ← 시간 블록 목록
              └── TimeBlock[]   ← <Droppable> + 상태 버튼

Express (localhost:3001)
  ├── /api/tasks       → tasks.js
  └── /api/schedules   → schedules.js

SQLite (data/todo.db)
  ├── tasks
  └── schedules
```

### 2.2 데이터 흐름

```
[백로그 추가]  사용자 입력 → POST /api/tasks → tasks 테이블 → UI 갱신
[DnD 배치]    drag TaskItem → drop on TimeBlock → POST /api/schedules → schedules 테이블
[상태 변경]   클릭 상태 버튼 → PUT /api/schedules/:id → UI 갱신
[날짜 이동]   날짜 선택 → GET /api/schedules?date=YYYY-MM-DD → TimeGrid 갱신
[블록 복귀]   drag TimeBlock → drop on TaskBacklog → DELETE /api/schedules/:id
```

---

## 3. Data Model

### 3.1 SQLite 스키마

```sql
-- 할일 백로그
CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,   -- 백로그 내 순서
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 시간 블록 (날짜 + 시간에 배치된 할일)
CREATE TABLE schedules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,             -- 'YYYY-MM-DD'
  start_hour INTEGER NOT NULL,            -- 0~23 (수기 입력)
  end_hour   INTEGER NOT NULL,            -- start_hour + 1 이상
  status     TEXT    NOT NULL DEFAULT 'planned',
                                          -- planned | in_progress | done | skipped
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, start_hour)               -- 같은 날 같은 시간에 중복 배치 불가
);
```

### 3.2 엔티티 관계

```
tasks 1 ──── N schedules
  id ◀────── task_id
```

- `tasks`에서 삭제하면 연결된 `schedules`도 CASCADE 삭제
- 하나의 task는 여러 날짜/시간대에 중복 배치 가능 (반복 작업 지원)

### 3.3 JavaScript 타입

```js
// Task (백로그 할일)
{
  id: number,
  title: string,
  position: number,
  created_at: string   // ISO datetime
}

// Schedule (배치된 시간 블록)
{
  id: number,
  task_id: number,
  title: string,       // JOIN으로 tasks.title 포함
  date: string,        // 'YYYY-MM-DD'
  start_hour: number,  // 0~23
  end_hour: number,
  status: 'planned' | 'in_progress' | 'done' | 'skipped',
  created_at: string
}
```

---

## 4. API Specification

### 4.1 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/tasks` | 백로그 전체 조회 (position 순) |
| POST | `/api/tasks` | 할일 추가 |
| DELETE | `/api/tasks/:id` | 할일 삭제 (연결 schedules도 삭제) |
| GET | `/api/schedules?date=YYYY-MM-DD` | 날짜별 스케줄 조회 (start_hour 순) |
| POST | `/api/schedules` | 스케줄 생성 (DnD 드롭 시) |
| PUT | `/api/schedules/:id` | 상태 또는 시간 수정 |
| DELETE | `/api/schedules/:id` | 스케줄 삭제 (블록 → 백로그 복귀) |

### 4.2 상세 명세

#### `GET /api/tasks`
```json
// Response 200
[
  { "id": 1, "title": "보고서 작성", "position": 0, "created_at": "..." },
  { "id": 2, "title": "코드 리뷰",   "position": 1, "created_at": "..." }
]
```

#### `POST /api/tasks`
```json
// Request
{ "title": "보고서 작성" }

// Response 201
{ "id": 1, "title": "보고서 작성", "position": 0, "created_at": "..." }
```

#### `DELETE /api/tasks/:id`
```
// Response 204 No Content
```

#### `GET /api/schedules?date=2026-05-11`
```json
// Response 200
[
  {
    "id": 1, "task_id": 1, "title": "보고서 작성",
    "date": "2026-05-11", "start_hour": 9, "end_hour": 10,
    "status": "planned", "created_at": "..."
  }
]
```

#### `POST /api/schedules`
```json
// Request (DnD 드롭 시)
{
  "task_id": 1,
  "date": "2026-05-11",
  "start_hour": 9,
  "end_hour": 10
}

// Response 201
{ "id": 1, "task_id": 1, "title": "보고서 작성", "date": "2026-05-11",
  "start_hour": 9, "end_hour": 10, "status": "planned", "created_at": "..." }

// Response 409 (시간 중복)
{ "error": "해당 시간대에 이미 일정이 있습니다." }
```

#### `PUT /api/schedules/:id`
```json
// Request (상태 변경)
{ "status": "done" }

// Request (시간 수정)
{ "start_hour": 10, "end_hour": 11 }

// Response 200 — 수정된 schedule 객체
```

#### `DELETE /api/schedules/:id`
```
// Response 204 No Content
```

### 4.3 에러 응답 형식

```json
{ "error": "메시지 (사용자에게 표시 가능한 텍스트)" }
```

| 상태코드 | 원인 |
|----------|------|
| 400 | 필수 필드 누락, 잘못된 형식 |
| 404 | 리소스 없음 |
| 409 | 같은 날 같은 start_hour 중복 |
| 500 | 서버 내부 오류 |

---

## 5. UI/UX Design

### 5.1 화면 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  ◀ 2026-05-11  ▶   [날짜 이동]         DateNavigator   │
├─────────────────────────────────────────────────────────┤
│  할 일 목록                              TaskBacklog    │
│  ┌──────────────┐ ┌──────────────┐                     │
│  │ 보고서 작성  │ │ 코드 리뷰   │  ← TaskItem (Drag)  │
│  └──────────────┘ └──────────────┘                     │
│  [+ 할일 추가]                                          │
├─────────────────────────────────────────────────────────┤
│  시간 계획                                TimeGrid      │
│  ┌──────┬──────────────────────────────────────────┐   │
│  │ 09시 │ [보고서 작성] [진행중] [완료] [건너뜀]  │   │
│  ├──────┼──────────────────────────────────────────┤   │
│  │ 10시 │ (빈 슬롯 — 드롭 가능)                   │   │
│  ├──────┼──────────────────────────────────────────┤   │
│  │ 11시 │ ...                                      │   │
│  └──────┴──────────────────────────────────────────┘   │
│  [+ 시간 블록 추가]                                     │
└─────────────────────────────────────────────────────────┘
```

### 5.2 컴포넌트 목록

| 컴포넌트 | 파일 | 책임 |
|----------|------|------|
| `App` | `App.jsx` | selectedDate 상태, DndContext 루트 |
| `DateNavigator` | `components/DateNavigator.jsx` | 날짜 ±1일 이동, 날짜 표시 |
| `TaskBacklog` | `components/TaskBacklog/TaskBacklog.jsx` | 백로그 목록, 할일 추가 입력, Droppable(복귀) |
| `TaskItem` | `components/TaskBacklog/TaskItem.jsx` | 개별 백로그 할일, Draggable |
| `TimeGrid` | `components/TimeGrid/TimeGrid.jsx` | 시간 블록 목록, 블록 추가 버튼 |
| `TimeBlock` | `components/TimeGrid/TimeBlock.jsx` | 시간 입력(수기), Droppable, 배치된 할일 표시 |
| `StatusBadge` | `components/TimeGrid/StatusBadge.jsx` | planned/in_progress/done/skipped 클릭 순환 |

### 5.3 DnD 설계 (`@dnd-kit/core`)

```
DndContext (App.jsx)
  ├── onDragEnd(event) 핸들러
  │     ├── over.id가 TimeBlock ID → POST /api/schedules
  │     └── over.id가 'backlog' → DELETE /api/schedules/:id
  │
  ├── <Droppable id="backlog">  ← TaskBacklog
  │
  ├── <Draggable id={`task-${task.id}`}>  ← TaskItem (백로그)
  ├── <Draggable id={`schedule-${schedule.id}`}>  ← TimeBlock 내 배치된 할일
  │
  └── <Droppable id={`timeblock-${timeblock.id}`}>  ← TimeBlock
```

---

## 6. State Management

```
App.jsx
  ├── selectedDate: string          (날짜, 기본값 오늘)
  ├── tasks: Task[]                 (백로그 전체)
  └── schedules: Schedule[]         (selectedDate의 스케줄)

훅 분리
  ├── useTasks()     → { tasks, addTask, deleteTask, fetchTasks }
  └── useSchedules(date) → { schedules, addSchedule, updateSchedule, removeSchedule }
```

---

## 7. Implementation Guide

### 7.1 구현 순서

1. [ ] `server/` 초기화 — `npm init`, `express`, `better-sqlite3` 설치
2. [ ] `server/db/schema.sql` 작성 및 `database.js` 연결
3. [ ] `server/routes/tasks.js` — tasks CRUD
4. [ ] `server/routes/schedules.js` — schedules CRUD
5. [ ] `server/index.js` — Express 조립, 미들웨어 설정
6. [ ] `client/` 초기화 — `npm create vite`, Tailwind CSS 설정
7. [ ] `client/vite.config.js` — `/api` 프록시 설정
8. [ ] `client/src/api/` — fetch 래퍼 함수
9. [ ] `TaskBacklog` + `TaskItem` 컴포넌트
10. [ ] `TimeGrid` + `TimeBlock` + `StatusBadge` 컴포넌트
11. [ ] `@dnd-kit/core` 통합 — DnD 연결
12. [ ] `DateNavigator` — 날짜 이동

### 7.2 의존성

```json
// server/package.json
{
  "dependencies": {
    "express": "^4.18.0",
    "better-sqlite3": "^9.0.0",
    "cors": "^2.8.5"
  }
}

// client/package.json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@dnd-kit/core": "^6.0.0",
    "@dnd-kit/sortable": "^7.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^3.0.0"
  }
}
```

### 7.3 파일 구조 (최종)

```
time_based_todolist/
├── server/
│   ├── db/
│   │   ├── schema.sql
│   │   └── database.js
│   ├── routes/
│   │   ├── tasks.js
│   │   └── schedules.js
│   ├── index.js
│   └── package.json
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   ├── tasks.js
│   │   │   └── schedules.js
│   │   ├── components/
│   │   │   ├── DateNavigator.jsx
│   │   │   ├── TaskBacklog/
│   │   │   │   ├── TaskBacklog.jsx
│   │   │   │   └── TaskItem.jsx
│   │   │   └── TimeGrid/
│   │   │       ├── TimeGrid.jsx
│   │   │       ├── TimeBlock.jsx
│   │   │       └── StatusBadge.jsx
│   │   ├── hooks/
│   │   │   ├── useTasks.js
│   │   │   └── useSchedules.js
│   │   └── App.jsx
│   ├── vite.config.js
│   └── package.json
├── data/                     # SQLite 파일 저장 (gitignore)
├── docs/
└── CLAUDE.md
```

---

## 8. Security Considerations

- [ ] SQL Injection 방지 — `better-sqlite3` prepared statements 사용 (`db.prepare()`)
- [ ] XSS 방지 — React 기본 escaping (dangerouslySetInnerHTML 미사용)
- [ ] CORS — `localhost:5173`만 허용 (개발 환경)
- [ ] `data/` 폴더 `.gitignore` 등록

---

## Version History

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-05-11 | 초안 작성 | mgcho@ideatec.co.kr |
