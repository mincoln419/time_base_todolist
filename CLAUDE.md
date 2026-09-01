# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**time_based_todolist** — 1시간 단위 수기 시간 입력으로 하루 일과를 계획하고, Drag & Drop으로 할일을 시간대에 배치하며, 상태 업데이트로 진행을 점검하는 일정관리 프로그램.

**Stack**: React (Vite) + Express + SQLite (`better-sqlite3`)  
**DnD**: `@dnd-kit/core`  
**Styling**: Tailwind CSS

## Commands

> 프로젝트 초기화 후 이 섹션을 업데이트할 것

```bash
# 서버 (포트 3001)
cd server && npm install && node index.js

# 클라이언트 (포트 5173)
cd client && npm install && npm run dev
```

## Architecture

```
time_based_todolist/
├── server/
│   ├── db/
│   │   ├── schema.sql        # 테이블 정의
│   │   └── database.js       # better-sqlite3 연결
│   ├── routes/
│   │   ├── tasks.js          # 할일 CRUD: GET/POST/DELETE /api/tasks
│   │   └── schedules.js      # 시간 블록: GET/POST/PUT/DELETE /api/schedules/:date
│   └── index.js              # Express 진입점
└── client/
    └── src/
        ├── components/
        │   ├── TaskBacklog/  # 상단 할일 백로그 영역
        │   ├── TimeGrid/     # 시간 그리드 (1시간 단위 블록 목록)
        │   └── TimeBlock/    # 개별 시간 블록 (시간 입력 + 드롭 대상)
        ├── hooks/            # useTasksAPI, useSchedulesAPI
        ├── api/              # fetch 래퍼 함수
        └── App.jsx           # 날짜 상태 + 레이아웃
```

**핵심 데이터 흐름**: 백로그 할일(tasks 테이블) → DnD → 시간 블록(schedules 테이블, date + hour 컬럼으로 연결)

**API 프록시**: `vite.config.js`에서 `/api` → `localhost:3001` 프록시 설정

## Environment Variables

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `PORT` | `3001` | Express 서버 포트 |
| `DB_PATH` | `./data/todo.db` | SQLite 파일 경로 |
| `CLAUDE_KEY` (또는 `CLAUD_KEY`) | 없음 (필수 — 리포 루트 `.env`, gitignore됨) | 데일리노트 "태그추출(AI)" 기능의 Anthropic API 키 |

## PDCA Status

- **Plan**: `docs/01-plan/features/time-based-todolist.plan.md`
- **현재 단계**: Design

---

## Behavioral Guidelines

### 1. Think Before Coding

Before implementing: state assumptions explicitly, surface tradeoffs, ask when unclear.

### 2. Simplicity First

Minimum code that solves the problem. No speculative abstractions, no unrequested flexibility.

### 3. Surgical Changes

Touch only what the task requires. Match existing style. Remove only orphans YOUR changes created.

### 4. Goal-Driven Execution

For multi-step tasks, state a brief plan with verifiable success criteria before starting.

---

## 도구 호출 최소화 원칙

| 상황 | 사용 도구 |
|------|-----------|
| 경로를 정확히 아는 경우 | `Read` 직접 호출 |
| 특정 심볼 위치 확인 | `Bash(grep -n)` 1회 |
| 넓은 코드베이스 탐색 (3회 이상 쿼리 예상) | `Agent(Explore)` |
| 단순 디렉토리 구조 확인 | `Bash(find -maxdepth 2)` |

**금지 패턴**: 같은 파일 반복 Read / find → grep → Read 3단계 연쇄 / 독립 작업을 순차 호출
