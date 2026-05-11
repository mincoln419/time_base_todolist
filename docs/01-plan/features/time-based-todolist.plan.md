# time-based-todolist Planning Document

> **Summary**: 1시간 단위 수기 시간 입력으로 일과를 계획하고, Drag & Drop으로 할일을 시간대에 배치하며, 상태 업데이트로 진행을 점검하는 일정관리 프로그램
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: mgcho@ideatec.co.kr
> **Date**: 2026-05-11
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

하루 일과를 1시간 단위로 계획하고, 할 일 목록에서 시간대로 드래그앤드롭하여 배치한 뒤, 실제 진행 상태를 업데이트하며 점검할 수 있는 개인 일정관리 도구.

### 1.2 Background

기존 달력/TODO 앱은 시간 블록 단위 계획과 할일 백로그를 연동하는 드래그앤드롭 UX가 부족함. 수기로 시간을 직접 입력하여 유연하게 시간 블록을 설정하고, 상태 추적까지 가능한 경량 로컬 앱이 필요.

### 1.3 Related Documents

- 없음 (신규 프로젝트)

---

## 2. Scope

### 2.1 In Scope

- [ ] 할일 백로그(Task Backlog) 영역: 상단에 할일 목록 입력 및 관리
- [ ] 시간 그리드 영역: 1시간 단위 시간 블록, 시작/종료 시간 수기 입력
- [ ] Drag & Drop: 백로그 → 시간 블록으로 할일 배치
- [ ] 할일 상태 관리: 예정(Planned) → 진행중(In Progress) → 완료(Done) → 미완료(Skipped)
- [ ] 데이터 로컬 저장: SQLite 파일 기반 영구 저장
- [ ] 날짜 단위 뷰: 하루 단위 일정 보기 및 날짜 이동

### 2.2 Out of Scope

- 캘린더 월간/주간 뷰 (v1에서는 일간 뷰만)
- 팀 협업 / 공유 기능
- 알림 / 푸시 기능
- 클라우드 동기화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| FR-01 | 할일 백로그 상단 영역에 할일 제목 입력 및 추가 | High | Pending |
| FR-02 | 백로그 할일을 시간 그리드로 Drag & Drop 배치 | High | Pending |
| FR-03 | 시간 블록의 시작/종료 시간을 1시간 단위로 수기 입력 | High | Pending |
| FR-04 | 시간 블록에 배치된 할일의 상태 변경 (Planned → In Progress → Done / Skipped) | High | Pending |
| FR-05 | 날짜 선택으로 해당 날짜의 일정 조회 | High | Pending |
| FR-06 | 시간 블록에서 백로그로 할일 되돌리기 (Drag & Drop) | Medium | Pending |
| FR-07 | 백로그 할일 삭제 | Medium | Pending |
| FR-08 | 시간 블록 삭제 (배치된 할일 백로그로 복귀) | Medium | Pending |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 측정 방법 |
|----------|------|-----------|
| 성능 | 드래그앤드롭 지연 없음 (< 16ms 렌더링) | 브라우저 DevTools |
| 저장 | 앱 재시작 후 데이터 유지 | 수동 테스트 |
| 호환성 | Chrome 최신 버전 기준 | 수동 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 백로그에 할일 추가/삭제 가능
- [ ] 시간 그리드에 1시간 단위 블록 표시 및 수기 시간 입력
- [ ] Drag & Drop으로 백로그 ↔ 시간 블록 간 이동
- [ ] 상태 변경 후 새로고침해도 데이터 유지
- [ ] 날짜 이동 시 해당 날짜 일정 로드

### 4.2 Quality Criteria

- [ ] Lint 오류 없음
- [ ] 빌드 성공
- [ ] 핵심 CRUD API 동작 확인

---

## 5. Risks and Mitigation

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| Drag & Drop 라이브러리 충돌 | High | Low | `@dnd-kit/core` 사용 (React 18 호환 안정적) |
| SQLite Windows 빌드 이슈 | Medium | Medium | `better-sqlite3` 사용, Node.js 버전 고정 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | 특징 | Selected |
|-------|------|:--------:|
| Starter | 정적 사이트 | ☐ |
| **Dynamic** | 풀스택, 자체 백엔드 | ☑ |
| Enterprise | 마이크로서비스 | ☐ |

### 6.2 Key Architectural Decisions

| 결정 | 선택 | 이유 |
|------|------|------|
| Frontend | React.js (Vite) | 요구사항 명시, 경량 빌드 |
| Backend | Node.js + Express | 요구사항 명시, 간단한 REST API |
| DB | SQLite (`better-sqlite3`) | 로컬 파일 기반, 설치 불필요 |
| Drag & Drop | `@dnd-kit/core` | React 18 호환, 접근성 지원 |
| 스타일링 | Tailwind CSS | 빠른 개발, 유틸리티 기반 |
| 상태 관리 | React useState / Context | 단순 앱, 외부 라이브러리 불필요 |
| API 통신 | fetch (native) | 의존성 최소화 |

### 6.3 폴더 구조

```
time_based_todolist/
├── server/                    # Node.js + Express 백엔드
│   ├── db/
│   │   ├── schema.sql         # 테이블 정의
│   │   └── database.js        # better-sqlite3 연결
│   ├── routes/
│   │   ├── tasks.js           # 할일 CRUD API
│   │   └── schedules.js       # 시간 블록 API
│   └── index.js               # Express 진입점 (포트 3001)
├── client/                    # React (Vite) 프론트엔드
│   ├── src/
│   │   ├── components/
│   │   │   ├── TaskBacklog/   # 상단 백로그 영역
│   │   │   ├── TimeGrid/      # 시간 그리드 영역
│   │   │   └── TimeBlock/     # 개별 시간 블록
│   │   ├── hooks/             # useTasksAPI, useDragDrop
│   │   ├── api/               # API 클라이언트 함수
│   │   └── App.jsx
│   └── vite.config.js         # 프록시: /api → localhost:3001
└── docs/
```

---

## 7. Convention Prerequisites

### 7.1 Conventions to Define

| 카테고리 | 규칙 |
|----------|------|
| 컴포넌트 파일 | PascalCase (`TimeBlock.jsx`) |
| 훅 파일 | camelCase (`useDragDrop.js`) |
| API 라우트 | REST: `/api/tasks`, `/api/schedules/:date` |
| 날짜 형식 | ISO 8601 (`YYYY-MM-DD`) |

### 7.2 Environment Variables

| 변수 | 용도 | 범위 |
|------|------|------|
| `PORT` | Express 서버 포트 (기본 3001) | Server |
| `DB_PATH` | SQLite 파일 경로 (기본 `./data/todo.db`) | Server |

---

## 8. Next Steps

1. [ ] `/pdca design time-based-todolist` — DB 스키마 및 API 상세 설계
2. [ ] `/pdca do time-based-todolist` — 구현 시작

---

## Version History

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-05-11 | 초안 작성 | mgcho@ideatec.co.kr |
