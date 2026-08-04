# 시간 기반 일정관리 (Time-Based Todolist)

1시간 단위로 하루 일과를 계획하고, 할 일을 드래그 앤 드롭으로 시간대에 배치하며 진행 상태를 관리하는 로컬 일정관리 앱.

## 주요 기능

- **할 일 백로그**: 상단에 할 일 목록을 추가하고 관리
- **시간 블록 배치**: 드래그 앤 드롭으로 할 일을 시간대에 배치 (기본 업무시간 09:00~18:00)
- **상태 관리**: 예정 → 진행중 → 완료 / 건너뜀 순환 클릭으로 변경
- **날짜 이동**: 하루 단위로 날짜를 이동하며 일정 조회
- **포커스 맵**: BJ Fogg의 행동 설계(Focus Mapping) 기법으로 할 일의 영향력·실행 가능성을 2단계로 평가해 우선순위 도출
- **로컬 저장**: SQLite 파일 기반 영구 저장 (서버 재시작 후에도 유지)

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind CSS |
| 드래그 앤 드롭 | @dnd-kit/core |
| 백엔드 | Node.js + Express |
| 데이터베이스 | SQLite (Node.js 내장 `node:sqlite`) |

> **Node.js 22.5 이상 필요** — `node:sqlite` 내장 모듈 사용 (별도 설치 불필요)

## 프로젝트 구조

```
time_based_todolist/
├── server/                  # Express 백엔드 (포트 3001)
│   ├── db/
│   │   ├── schema.sql       # DB 테이블 정의
│   │   └── database.js      # SQLite 연결 및 DDL 초기화
│   ├── routes/
│   │   ├── tasks.js         # 할 일 CRUD API
│   │   ├── schedules.js     # 시간 블록 API
│   │   └── focusmap.js      # 포커스 맵 세션 API
│   └── index.js
├── client/                  # React 프론트엔드 (포트 5173)
│   └── src/
│       ├── api/             # fetch 래퍼
│       ├── hooks/           # useTasks, useSchedules, useFocusMap
│       ├── components/
│       │   ├── TaskBacklog/ # 백로그 영역
│       │   ├── TimeGrid/    # 시간 그리드 영역
│       │   └── FocusMap/    # 포커스 맵 탭 (BJ Fogg 행동 설계)
│       └── App.jsx          # 상단 탭(일정관리 / 포커스 맵)으로 화면 전환
└── data/                    # SQLite DB 파일 저장 위치 (자동 생성)
```

## 설치 및 실행

### 사전 요구사항

- Node.js 22.5 이상

### 1. 서버 실행

```bash
cd server
npm install
npm start
# → http://localhost:3001
```

개발 모드 (파일 변경 시 자동 재시작):

```bash
npm run dev
```

### 2. 클라이언트 실행

새 터미널에서:

```bash
cd client
npm install
npm run dev
# → http://localhost:5173
```

브라우저에서 `http://localhost:5173` 접속.

## 환경 변수

서버 루트에 `.env` 파일로 설정 가능 (선택사항):

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | Express 서버 포트 |
| `DB_PATH` | `./data/todo.db` | SQLite 파일 경로 |

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/tasks` | 백로그 전체 조회 |
| POST | `/api/tasks` | 할 일 추가 |
| DELETE | `/api/tasks/:id` | 할 일 삭제 |
| GET | `/api/schedules?date=YYYY-MM-DD` | 날짜별 스케줄 조회 |
| POST | `/api/schedules` | 시간 블록 생성 |
| PUT | `/api/schedules/:id` | 상태/시간 수정 |
| DELETE | `/api/schedules/:id` | 시간 블록 삭제 |
| GET | `/api/focusmap` | 저장된 포커스 맵 세션 조회 (없으면 `null`) |
| PUT | `/api/focusmap` | 포커스 맵 세션 저장 (전체 상태를 JSON으로 upsert) |
| DELETE | `/api/focusmap` | 포커스 맵 세션 초기화 |