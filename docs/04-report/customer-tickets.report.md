# customer-tickets Completion Report

> **Status**: Complete
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Completion Date**: 2026-08-09
> **PDCA Cycle**: #1

---

## Executive Summary

| Item | Content |
|------|---------|
| Feature | 고객사대응 별 티켓 관리 탭 (customer-tickets) |
| Start Date | 2026-08-09 |
| End Date | 2026-08-09 |
| Duration | 반나절 (Plan→Design→Do→Check 단일 세션) |
| Design Match Rate | **99%** (기준 90% 초과) |
| 요구사항 완료 | 16 / 16 FR (100%) |
| 변경 파일 | 신규 9개 + 수정 3개 |
| 신규 코드 | 약 383줄 (서버 4개 라우트 파일 + 클라이언트 api/hooks/components) |

### Value Delivered

| Perspective | Content |
|-------------|---------|
| **Problem** | 여러 고객사를 동시에 대응할 때, 어떤 고객사에 어떤 티켓(업무)이 남아있는지 관리할 화면이 없어 앱 밖에 흩어져 있었다 |
| **Solution** | 포커스 맵과 동일한 좌(고객사 목록)·우(티켓 상세) 2단 탭을 추가하고, "+"로 티켓을 추가하면 토글 방식(등록 전 → 취소선+회색)으로 상태를 표시하며, 생성 즉시 일정관리 할일 백로그에도 `[고객사명] 제목` 형식으로 반영되도록 구현했다 |
| **Function/UX Effect** | 고객사 전환 한 번으로 해당 건의 티켓을 추가·확인할 수 있고, 처리된 티켓은 시각적으로 구분되며, 별도 재입력 없이 일정관리 탭에서 곧바로 드래그로 시간표에 배치 가능함을 브라우저 E2E로 실측 확인했다 |
| **Core Value** | 여러 고객사 대응 업무를 한 화면에서 트래킹하면서 실행(일정 배치)까지 손실 없이 이어주는 경량 티켓 트래커를 제공, Design Match Rate 99%로 설계-구현 괴리를 최소화했다 |

---

## 1. Summary

### 1.1 Results Summary

```
┌─────────────────────────────────────────────┐
│  Design Match Rate: 99%                      │
├─────────────────────────────────────────────┤
│  ✅ Complete:     16 / 16 FR                 │
│  ⏳ In Progress:   0 / 16 FR                 │
│  ❌ Cancelled:     0 / 16 FR                 │
└─────────────────────────────────────────────┘
```

---

## 2. Related Documents

| Phase | Document | Status |
|-------|----------|--------|
| Plan | [customer-tickets.plan.md](../01-plan/features/customer-tickets.plan.md) | ✅ Finalized |
| Design | [customer-tickets.design.md](../02-design/features/customer-tickets.design.md) | ✅ Finalized |
| Check | [customer-tickets.analysis.md](../03-analysis/customer-tickets.analysis.md) | ✅ Complete (99%) |
| Act | Current document | ✅ Complete |

---

## 3. Completed Items

### 3.1 Functional Requirements

| ID | 요구사항 | 상태 | 비고 |
|----|----------|------|------|
| FR-01 | `customers` 테이블 (`id`, `name`, `created_at`) | ✅ Complete | |
| FR-02 | `tickets` 테이블 (`id`, `customer_id` FK CASCADE, `title`, `registered`, `created_at`) | ✅ Complete | |
| FR-03 | `GET /api/customers` 목록 조회 | ✅ Complete | curl 검증 |
| FR-04 | `POST /api/customers` 고객사 추가 (공백 400) | ✅ Complete | curl 검증 |
| FR-05 | `DELETE /api/customers/:id` 삭제 (CASCADE) | ✅ Complete | curl로 티켓 2개 보유 상태에서 CASCADE 확인 |
| FR-06 | `GET /api/customers/:id/tickets` 티켓 목록 조회 | ✅ Complete | curl 검증 |
| FR-07 | `POST /api/customers/:id/tickets` 티켓 추가 (공백 400) | ✅ Complete | curl 검증 |
| FR-08 | `PATCH /api/tickets/:id/toggle` 등록 상태 반전 | ✅ Complete | curl로 0→1→0 검증 |
| FR-09 | `DELETE /api/tickets/:id` 티켓 삭제 | ✅ Complete | curl 검증 |
| FR-10 | 신규 탭 좌(고객사)·우(티켓) 레이아웃 | ✅ Complete | 브라우저 스크린샷 확인 |
| FR-11 | 고객사 추가 시 즉시 목록 반영 + 빈 상태 문구 | ✅ Complete | |
| FR-12 | 고객사 클릭 시 우측 갱신 + 선택 강조 | ✅ Complete | |
| FR-13 | "+" 클릭 → 제목 입력 → 티켓 즉시 반영 | ✅ Complete | Playwright E2E 검증 |
| FR-14 | 토글 시 취소선 + 회색 표시 | ✅ Complete | E2E로 `line-through text-gray-400` 클래스 확인 |
| FR-15 | 고객사 미선택 시 안내 문구 | ✅ Complete | |
| FR-16 | 티켓 추가 시 일정관리 할일 백로그에도 동시 반영 | ✅ Complete | E2E로 `[acme] 로그인 오류 문의`가 일정관리 탭에 등장함을 확인 |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 달성 | 상태 |
|----------|------|------|------|
| 일관성 | `tasks`/`schedules`와 동일한 API·에러 포맷 재사용 | `{ error: string }`, prepared statements 동일 패턴 | ✅ |
| 데이터 무결성 | 공백 이름/제목 거부 | 서버 400 검증 완료 | ✅ |
| 회귀 방지 | 기존 일정관리/포커스맵 탭 영향 없음 | `App.jsx` 외 기존 컴포넌트/라우트 무변경, `npx vite build` 성공 | ✅ |
| 보안 | SQL Injection 방지, XSS 회피 | 전 쿼리 파라미터 바인딩, React 기본 이스케이프 | ✅ |

### 3.3 Deliverables

| Deliverable | 위치 | 상태 | 파일 수 |
|-------------|------|------|--------|
| 서버 라우트 (신규) | `server/routes/customers.js`, `tickets.js` | ✅ | 2개 |
| 서버 스키마/등록 (수정) | `server/db/schema.sql`, `server/index.js` | ✅ | 2개 |
| 클라이언트 API 래퍼 (신규) | `client/src/api/customers.js`, `tickets.js` | ✅ | 2개 |
| 클라이언트 훅 (신규) | `client/src/hooks/useCustomers.js`, `useTickets.js` | ✅ | 2개 |
| 리액트 컴포넌트 (신규) | `client/src/components/CustomerTickets/` | ✅ | 3개 |
| 탭 통합 (수정) | `client/src/App.jsx` | ✅ | 1개 |
| 문서화 | `docs/` (Plan/Design/Analysis/Report) | ✅ | 4개 |

---

## 4. Implementation Details

### 4.1 Database Schema (100% 일치)

**customers 테이블** — `id`, `name`(NOT NULL), `created_at`

**tickets 테이블** — `id`, `customer_id`(FK → customers.id, ON DELETE CASCADE), `title`(NOT NULL), `registered`(0/1, 기본 0), `created_at`. `PRAGMA foreign_keys = ON`(기존 `database.js`)이 이미 적용되어 있어 CASCADE가 실제로 동작함을 curl로 검증.

### 4.2 API 엔드포인트 (7개, 100% 구현)

| Method | Path | 설명 | 상태 |
|--------|------|------|------|
| GET | `/api/customers` | 고객사 목록 조회 | ✅ |
| POST | `/api/customers` | 고객사 추가 | ✅ |
| DELETE | `/api/customers/:id` | 고객사 삭제 (CASCADE) | ✅ |
| GET | `/api/customers/:id/tickets` | 티켓 목록 조회 | ✅ |
| POST | `/api/customers/:id/tickets` | 티켓 추가 | ✅ |
| PATCH | `/api/tickets/:id/toggle` | 등록 상태 반전 | ✅ |
| DELETE | `/api/tickets/:id` | 티켓 삭제 | ✅ |

### 4.3 React 컴포넌트 (100% 구현)

| 컴포넌트/훅 | 책임 | 구현 상태 |
|---------|------|----------|
| `CustomerTickets.jsx` | 좌우 레이아웃 컨테이너, 선택 고객사 상태, 티켓 생성 시 `addTask` 연동 | ✅ |
| `CustomerList.jsx` | 좌측 고객사 목록 (추가/선택/삭제 confirm) | ✅ |
| `TicketPanel.jsx` | 우측 티켓 목록, "+" 추가, 토글(취소선+회색) | ✅ |
| `useCustomers` | 고객사 목록 조회/생성/삭제 | ✅ |
| `useTickets` | 선택 고객사의 티켓 조회/생성/토글/삭제 | ✅ |

### 4.4 Key Implementation Decisions

1. **`registered` 불리언 토글**: 요구사항이 "등록 전 ↔ 등록됨" 2단계뿐이라 `schedules.status`식 다단계 enum 대신 0/1 정수 컬럼으로 단순화.
2. **API 응답은 snake_case 그대로 반환**: Design 문서 예시(camelCase)와 달리, 실제로는 `tasks`/`schedules`처럼 `SELECT *` 결과를 가공 없이 반환하는 기존 컨벤션을 따름 (Gap Analysis §2에서 확인, 기능 영향 없음).
3. **일정관리 백로그 연동은 클라이언트 오케스트레이션**: 서버 조인 없이, 티켓 생성 성공 직후 `App.jsx`가 보유한 `useTasks().addTask()`를 `[고객사명] 제목` 형식으로 호출 — 포커스 맵의 "할일로 추가"와 동일한 느슨결합 패턴.
4. **목록/상세 훅 분리**: `useFocusMapList`/`useFocusMap` 선례를 따라 `useCustomers`(목록)·`useTickets(customerId)`(상세)로 분리, 갱신 시점이 다른 두 상태를 명확히 구분.

---

## 5. Quality Metrics

### 5.1 Gap Analysis Results (Design vs Implementation)

| 카테고리 | 점수 | 상태 | 비고 |
|----------|:----:|:----:|------|
| DB 스키마 | 100% | ✅ OK | 테이블/제약 전부 일치, CASCADE curl 검증 |
| API 엔드포인트 | 95% | ✅ OK | 응답 키 표기(snake_case)만 문서 예시와 차이, 기능은 100% 일치 |
| 컴포넌트 구조 | 100% | ✅ OK | 9개 파일 전부 설계 경로·책임 준수 |
| 일정관리(tasks) 연동 | 100% | ✅ OK | E2E로 백로그 반영 실측 확인 |
| 상태 관리 | 100% | ✅ OK | 목록/상세 훅 분리, `addTask` props 재사용 |
| 보안 | 100% | ✅ OK | prepared statements, XSS 방지 |
| UI 체크리스트 | 95% | ✅ OK | 티켓 입력 취소 버튼 부재(Low, 선택 사항) |
| **전체 Match Rate** | **99%** | **✅ Complete** | **기준 90% 초과** |

### 5.2 Verification Performed

| 검증 방법 | 대상 | 결과 |
|-----------|------|------|
| curl (L1 API) | 7개 엔드포인트 상태 코드/응답 형태 | 전항목 통과 |
| curl (CASCADE) | 티켓 2개 보유 고객사 삭제 | 티켓 함께 삭제, 이후 조회 404 |
| Playwright E2E | 고객사 추가→선택→티켓 추가→토글→일정관리 탭 반영 | 전 흐름 통과, 콘솔 에러 0건, 스크린샷 3장 확보 |
| `npx vite build` | 프로덕션 빌드 | 성공 (39 modules, 820ms) |

### 5.3 Code Quality

| 항목 | 기준 | 결과 | 상태 |
|------|------|------|------|
| 빌드 성공 | 성공 | 성공 | ✅ |
| API 동작 | 7/7 엔드포인트 | 7/7 확인 | ✅ |
| 콘솔 에러 (브라우저) | 0건 | 0건 | ✅ |
| 회귀 | 기존 탭 무영향 | `App.jsx` 외 기존 파일 무변경 | ✅ |

---

## 6. Lessons Learned & Retrospective

### 6.1 What Went Well (Keep)

1. **선례 재사용**: 포커스 맵의 목록/상세 훅 분리, tasks 연동(느슨 결합) 패턴을 그대로 가져와 설계·구현 속도가 빨랐고 Match Rate도 높게 나옴.
2. **단일 세션 Plan→Design→Do→Check**: 문서가 상세해 구현 단계에서 재판단할 부분이 거의 없었음.
3. **실제 브라우저 E2E 검증**: `npx vite build` 통과만으로 끝내지 않고 Playwright로 실제 클릭·토글·탭 전환까지 확인해 FR-16(백로그 연동) 같은 크로스 도메인 요구사항의 실제 동작을 담보함.

### 6.2 What Needs Improvement (Problem)

1. **문서-구현 표기 불일치**: Design 문서의 API 응답 예시가 camelCase였지만 실제 구현은 snake_case — Design 작성 시점에 기존 `tasks.js`/`schedules.js`를 다시 확인했다면 피할 수 있었던 사소한 불일치.
2. **티켓 입력 취소 UX 미흡**: "+" 클릭 후 명시적 취소 버튼이 없어 blur에만 의존.
3. **자동화 테스트 없음**: 프로젝트 전반에 테스트 스크립트가 없어(기존 관행) 이번에도 수동/1회성 E2E 스크립트로 대체.

### 6.3 What to Try Next (Try)

1. `TicketPanel.jsx`에 명시적 "취소" 버튼 추가 (Low 우선순위).
2. Design 문서 §4.2 JSON 예시를 실제 snake_case 응답으로 사후 보정.
3. 고객사 이름 변경(rename), 티켓 검색/필터 등은 Plan §2.2에서 Out of Scope로 명시한 대로 후속 사이클에서 별도 기획.

---

## 7. Next Steps

### 7.1 Immediate

- [ ] (선택) `TicketPanel.jsx` 취소 버튼 추가
- [ ] (선택) Design 문서 API 응답 예시 표기 보정

### 7.2 Next PDCA Cycle (candidates)

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| 고객사 정보 수정(rename, 담당자/연락처) | Medium | Plan §2.2 Out of Scope로 명시됨 |
| 티켓 다단계 상태(진행중/보류 등) | Low | 현재는 등록 전/등록됨 2단계만 |
| 티켓 ↔ 할일 양방향 동기화 | Low | 현재는 생성 시점 단방향 전달만 |

---

## 8. Changelog

### v0.1.0 (2026-08-09)

**Added**
- `customers`/`tickets` 테이블 및 7개 REST 엔드포인트
- "고객사 티켓" 탭 — 좌(고객사 목록)·우(티켓 상세) 레이아웃
- 티켓 등록 상태 토글 (취소선 + 회색 표시)
- 티켓 생성 시 일정관리 할일 백로그(`[고객사명] 제목`) 동시 반영

**Known Issues**
- 티켓 "+" 입력에 명시적 취소 버튼 없음 (blur로만 닫힘)

### v0.1.1 (2026-08-09)

**Added**
- 티켓에 `desired_date`(희망 일자, 선택 입력) 필드 추가 — 생성 시 입력 가능, 생성 후에도 각 행의 date input으로 수정 가능
- `PATCH /api/tickets/:id/desired-date` 엔드포인트
- `server/db/database.js`에 기존 로컬 DB용 1회성 마이그레이션 가드 (`ALTER TABLE tickets ADD COLUMN desired_date TEXT`, 기존 데이터 보존 확인)

**Verified**
- curl로 생성 시 지정/이후 수정/해제(null) 전부 확인
- Playwright E2E로 생성 시 날짜 입력 → 값 수정 → 새로고침 후에도 유지됨을 확인, 마이그레이션 후 기존 고객사/티켓 데이터 손실 없음 확인

---

## 9. 결론

**customer-tickets v0.1.0은 성공적으로 완성되었습니다.**

- **99% Design Match Rate** 달성 (기준 90% 초과)
- **16개 기능 요구사항 전부 완성** (100% 완료율)
- **curl + Playwright E2E로 API·UI·크로스 도메인 연동(FR-16) 전부 실측 검증**
- 기존 일정관리/포커스 맵 탭에 회귀 없음, `npx vite build` 성공

즉시 수정이 필요한 결함은 없으며, 남은 항목(취소 버튼, 문서 표기 보정)은 모두 Low 우선순위 선택 사항입니다.

---

## Version History

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-08-09 | 완료 보고서 작성 | Mincoln Cho |
