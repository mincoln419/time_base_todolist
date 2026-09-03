# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**time_based_todolist** — 1시간 단위 수기 시간 입력으로 하루 일과를 계획하고, Drag & Drop으로 할일을 시간대에 배치하며, 상태 업데이트로 진행을 점검하는 일정관리 프로그램.

**Stack**: React (Vite) + Express + Firebase Firestore (`firebase-admin`, 서버에서만 접근)  
**DnD**: `@dnd-kit/core`  
**Styling**: Tailwind CSS

> 2026-09 SQLite(`node:sqlite`) → Firestore로 마이그레이션 완료. 원본 SQLite 데이터(`data/todo.db`)는
> 롤백 대비 보관 중이며, 서버는 이제 `firebase-admin`으로만 Firestore에 접근한다(클라이언트에는
> Firebase SDK를 노출하지 않음, REST API 계약은 이전과 동일하게 유지).

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
│   │   ├── firestore.js      # firebase-admin 초기화, Firestore 클라이언트 싱글턴
│   │   ├── collections.js    # 컬렉션 이름 상수 (+ _counters 카운터 키)
│   │   ├── util.js           # nowString/nextId/asyncHandler 등 공용 헬퍼
│   │   ├── database.js       # (레거시) node:sqlite 연결 — 마이그레이션 스크립트 전용
│   │   └── schema.sql        # (레거시) 원본 SQLite 스키마, 참고용
│   ├── scripts/
│   │   ├── migrate-to-firestore.js  # 1회성 SQLite→Firestore 마이그레이션
│   │   └── verify-migration.js      # 마이그레이션 결과 검증
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

**핵심 데이터 흐름**: 백로그 할일(`tasks` 컬렉션) → DnD → 시간 블록(`schedules` 컬렉션, date + start_min 필드로 연결)

**API 프록시**: `vite.config.js`에서 `/api` → `localhost:3001` 프록시 설정

## Environment Variables

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `PORT` | `3001` | Express 서버 포트 |
| `FIREBASE_PROJECT_ID` | 없음 (필수) | Firestore 프로젝트 ID |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | 없음 (필수) | 서비스 계정 키 JSON 경로(리포 루트 기준 상대경로, 파일 자체는 gitignore됨) |
| `DB_PATH` | `./data/todo.db` | (레거시) 마이그레이션 스크립트가 참조하는 원본 SQLite 파일 경로 |
| `CLAUDE_KEY` (또는 `CLAUD_KEY`) | 없음 (필수 — 리포 루트 `.env`, gitignore됨) | 데일리노트 "태그추출(AI)" 기능의 Anthropic API 키 |
| `QWEN_KEY` | (필수) | 회의록 액션아이템 AI 자동생성용 API 키 — 프로젝트 루트 `.env`(gitignored)에 저장, 절대 커밋 금지 |
| `MEETING_AI_API_URL` | Aliyun MaaS 엔드포인트로 하드코딩된 기본값 | 필요 시 `.env`에서 override |
| `MEETING_AI_MODEL` | `qwen3.8-max` | 필요 시 `.env`에서 override |

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
