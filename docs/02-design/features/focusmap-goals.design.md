---
template: design
version: 1.3
---

# focusmap-goals Design Document

> **Summary**: 포커스 맵을 목표별 다중 세션으로 저장/조회하고, 겹쳐 보기 결과에서 선택한 행동을 할일 백로그로 전환하는 기능의 설계
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-04
> **Status**: Draft
> **Planning Doc**: [focusmap-goals.plan.md](../../01-plan/features/focusmap-goals.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline(schema.md/conventions.md 등)을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 단일 세션 구조라 목표별 재사용이 불가능하고, 분석 결과가 실행(할일)로 이어지지 않음 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 여러 목표를 오가며 하루 계획을 짜는 사람 |
| **RISK** | 단일 row → 목표별 다중 row로의 스키마 변경, 기존 세션 데이터 이관 여부 |
| **SUCCESS** | 좌측 목록에서 저장된 목표를 선택해 이어보기 가능 + 겹쳐보기 화면에서 선택한 항목이 할일 백로그에 실제로 추가됨 |
| **SCOPE** | (1) focus_map 스키마 변경 (2) 서버 API 확장 (3) 좌측 목표 리스트 UI (4) 결과 화면 체크박스 + 변환 버튼 (5) tasks API 연동 |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 1. Overview

### 1.1 Design Goals

- 포커스 맵 세션을 목표(goal)별로 독립 저장·조회·삭제할 수 있는 구조로 전환한다.
- "겹쳐 보기" 결과의 항목을 기존 할일 백로그(`tasks`)로 원클릭 전환한다.
- 기존 단일 세션 MVP의 사용자 흐름과 코드 컨벤션(리소스당 1 API 파일 + 1 훅 + 1 라우트 파일)을 최대한 재사용한다.

### 1.2 Design Principles

- **컨벤션 재사용**: `tasks.js`/`schedules.js`와 동일하게, 포커스 맵 리소스도 API 파일 1개·라우트 파일 1개에 전체 CRUD를 모은다.
- **단순함 우선**: 로컬 단일 사용자 앱이므로 인증, 락, 페이지네이션, 실시간 동기화를 도입하지 않는다.
- **영속성 원칙 유지**: 진행 단계·체크 상태를 포함한 전체 세션은 항상 서버 JSON으로 저장되어 새로고침 후에도 유지된다 (기존 "JSON으로 저장" 요구사항 계승).

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | FocusMap.jsx 안에 목록+편집 로직 전부 집어넣음 | 목록/세션 훅 분리 + FocusMapLayout.jsx 컨테이너 추가 | 목록/세션 훅만 분리, 레이아웃은 FocusMap.jsx가 겸함 |
| **New Files** | 0 | 3 | 2 |
| **Modified Files** | 4 | 4 | 4 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | Low (coupled) | Low (clean) | Low (balanced) |
| **Recommendation** | Quick wins | Long-term projects | **Default choice** |

**Selected**: **Option C — Pragmatic Balance**
**Rationale**: 목록 조회/삭제(`useFocusMapList`)와 활성 세션 로드/저장(`useFocusMap`)은 갱신 시점과 생명주기가 다르므로(목록은 저장·삭제 이벤트에만 재조회, 세션은 매 입력마다 갱신) 분리가 자연스럽고 실제로 필요한 구분이다. 다만 이 프로젝트 규모에서 별도 `FocusMapLayout.jsx` 컨테이너까지 두는 것은 과설계이므로, 기존 `FocusMap.jsx`가 좌(목록)·우(편집) 레이아웃 컨테이너 역할을 겸하도록 한다.

> 아래 상세 설계는 Option C를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌────────────┐      ┌──────────────────────────┐      ┌──────────────┐
│ FocusMap   │─────▶│ Express /api/focusmap     │─────▶│ SQLite       │
│ 탭 (SPA)   │◀─────│ routes (GET/POST/PUT/DEL) │◀─────│ focus_map    │
└─────┬──────┘      └──────────────────────────┘      └──────────────┘
      │
      └────▶ 기존 useTasks().addTask() ────▶ POST /api/tasks (변경 없음) ────▶ tasks 테이블
```

### 2.2 Data Flow

```
탭 진입 → useFocusMapList로 좌측 목록 로드
  → 목록 클릭 시: useFocusMap(id)로 해당 세션 로드 → 저장 당시 단계로 진입
  → "새 목표 시작" 클릭 시: activeId=null, 로컬 초안(goal:'', items:[], step:0)만 유지
  → "영향력부터 매기기" 클릭 시: POST로 최초 저장 → 응답의 id를 activeId로 설정 → 목록 재조회
  → 이후 모든 변경(rating pick, back, redo 등): PUT /api/focusmap/:id
  → 겹쳐 보기에서 항목 체크 → "할일로 추가" 클릭 → 선택 항목마다 기존 addTask() 호출
    → 성공한 item.id들을 addedTaskIds에 추가 → PUT으로 세션 저장
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `FocusMap.jsx` | `useFocusMapList`, `useFocusMap`, `useTasks` | 좌측 목록 + 활성 세션 편집 화면 조합, 할일 변환 시 기존 `addTask` 재사용 |
| `FocusMapList.jsx` | (props로만 데이터 수신, 훅 직접 호출 없음) | 목록 표시/선택/삭제/새 목표 버튼 — 순수 표시 컴포넌트 |
| `useFocusMap.js` | `api/focusMap.js` | 활성 세션 1건의 로드/생성/저장 |
| `useFocusMapList.js` | `api/focusMap.js` | 목록 조회 + 삭제, 저장/생성 이벤트 후 재조회 |

---

## 3. Data Model

### 3.1 Entity Definition

세션 상태는 `focus_map.data` 컬럼에 JSON 문자열로 저장된다 (TS 타입 파일은 신설하지 않음 — 프로젝트가 순수 JS이므로 아래는 문서화 목적의 shape 설명):

```
FocusMapSession (data 컬럼 JSON 내용)
{
  goal: string,                 // 목표명 — 세션 전체의 UNIQUE 키
  items: [
    {
      id: string,                // 클라이언트 uid() 생성값, 예: "b1a2b3"
      text: string,
      impact: number | null,     // 1~5
      ability: number | null,    // 1~5
    },
    ...
  ],
  step: 0 | 1 | 2 | 3,
  cursor: number,
  addedTaskIds: string[],       // 이미 tasks 백로그로 전송한 item.id 목록 (FR-13)
}
```

### 3.2 Entity Relationships

```
[focus_map] (goal 단위 세션)  ── (참조/FK 없음, 느슨한 결합) ──▶  [tasks] (할일 백로그, 기존)
```

"할일로 추가" 시 `tasks`에 새 row가 생성되지만 외래키는 두지 않는다. `addedTaskIds`는 포커스 맵 쪽에서만 보는 로컬 표시이며, `tasks`에서 해당 항목이 나중에 삭제되어도 갱신되지 않는다 — Plan §5 Risks에서 이미 Out of Scope로 확정된 제약이다.

### 3.3 Database Schema

```sql
-- 기존 단일 세션 구조 폐기. 현재 focus_map 테이블은 비어 있는 로컬 개발 데이터이므로
-- 별도 이관 스크립트 없이 재생성한다 (Plan §5 Risk에 대한 Design 단계 결정).
DROP TABLE IF EXISTS focus_map;

CREATE TABLE IF NOT EXISTS focus_map (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  goal       TEXT    NOT NULL UNIQUE,
  data       TEXT    NOT NULL,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

> `DROP TABLE IF EXISTS`는 `schema.sql`이 서버 시작 시 매번 `db.exec()`되는 이 프로젝트 구조상, 배포 후에도 재시작마다 테이블을 비우게 된다. Do 단계에서는 이 한 줄을 최초 1회 수동 마이그레이션으로만 실행하고 이후에는 제거하거나, `server/db/database.js`에 "컬럼 존재 여부 확인 후 1회만 DROP" 가드를 추가하는 방식을 검토한다. (세부 구현 방식은 Do 단계에서 확정)

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/focusmap` | 저장된 세션 요약 리스트 조회 (`updated_at desc`) | 없음 (로컬 단일 사용자) |
| GET | `/api/focusmap/:id` | 특정 세션 전체 상태 조회 | 없음 |
| POST | `/api/focusmap` | 새 세션 생성 | 없음 |
| PUT | `/api/focusmap/:id` | 세션 갱신 (upsert) | 없음 |
| DELETE | `/api/focusmap/:id` | 세션 삭제 | 없음 |

### 4.2 Detailed Specification

#### `GET /api/focusmap`

**Response (200):**
```json
[
  { "id": 3, "goal": "매일 책 읽기", "updatedAt": "2026-08-04 13:20:00", "step": 3, "itemCount": 5, "goldCount": 3 },
  { "id": 2, "goal": "운동 습관", "updatedAt": "2026-08-03 09:10:00", "step": 1, "itemCount": 4, "goldCount": 0 }
]
```

#### `GET /api/focusmap/:id`

**Response (200):**
```json
{
  "id": 3,
  "goal": "매일 책 읽기",
  "items": [{ "id": "b1a2b3", "text": "매일 30분 읽기", "impact": 4, "ability": 3 }],
  "step": 3,
  "cursor": 0,
  "addedTaskIds": ["b1a2b3"]
}
```
**Error**: `404` — `{ "error": "찾을 수 없습니다." }`

#### `POST /api/focusmap`

**Request:**
```json
{ "goal": "매일 책 읽기", "items": [], "step": 1, "cursor": 0, "addedTaskIds": [] }
```
**Response (201 Created)**: 저장된 전체 객체(`id` 포함)

**Error Responses:**
- `400` — goal 누락/공백: `{ "error": "목표를 입력해주세요." }`
- `409` — goal 중복: `{ "error": "이미 저장된 목표입니다." }`

#### `PUT /api/focusmap/:id`

**Request:** POST와 동일한 shape (전체 상태를 매번 upsert)
**Response (200)**: 저장된 전체 객체

**Error Responses:**
- `404` — 존재하지 않는 id
- `409` — goal을 다른 기존 세션과 중복되게 변경 시도

#### `DELETE /api/focusmap/:id`

**Response**: `204 No Content`
**Error**: `404` — 존재하지 않는 id

> "할일로 추가"는 새 API를 만들지 않고 기존 `POST /api/tasks`를 선택 항목 수만큼 반복 호출한다 (변경 없음).

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌────────────────────────────────────────────────────────────────┐
│ [일정관리] [포커스 맵]                                            │  ← App.jsx 상단 탭 (기존, 변경 없음)
├───────────────────┬──────────────────────────────────────────┤
│ 저장된 목표         │  BJ 포그 · 행동 설계 · {진행 단계}            │
│ ───────────────    │  포커스 맵                                  │
│ [+ 새 목표 시작]     │  [행동모으기][1판·영향력][2판·능력][겹쳐보기]  │
│                    │                                            │
│ ● 매일 책 읽기       │  (선택된 세션의 기존 단계별 화면 — 변경 없음,   │
│   3단계 · 황금 3개   │   결과 화면에만 체크박스 + 변환 버튼 추가)      │
│   [삭제]            │                                            │
│                    │                                            │
│ ○ 운동 습관          │                                            │
│   1단계             │                                            │
│   [삭제]            │                                            │
└───────────────────┴──────────────────────────────────────────┘
```

### 5.2 User Flow

```
FocusMap 탭 진입 → 좌측 목록 로드
  ├─ 저장된 목표 클릭 → 해당 세션 로드 → 저장 당시 단계로 이어보기
  └─ "새 목표 시작" 클릭 → 빈 0단계 편집 화면
       → 행동 모으기 → "영향력부터 매기기" 클릭 → (최초 저장, 좌측 목록에 등장)
       → 1판 → 2판 → 겹쳐 보기
       → 항목 체크 → "선택 항목 할일로 추가" → 일정관리 탭 할일 목록에 반영, "추가됨" 표시
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `FocusMap.jsx` | `client/src/components/FocusMap/` | 좌(목록)·우(편집) 레이아웃 컨테이너, activeId 상태 보유, 할일 변환 버튼 로직 |
| `FocusMapList.jsx` | `client/src/components/FocusMap/` | 좌측 목표 리스트 표시/선택/삭제/새 목표 버튼 (순수 표시) |
| `useFocusMap` | `client/src/hooks/` | 활성 세션 1건의 로드·생성·저장 |
| `useFocusMapList` | `client/src/hooks/` | 목록 조회·삭제 |

### 5.4 Page UI Checklist

#### FocusMap 탭 — 좌측 목록 (FocusMapList)

- [ ] 버튼: "+ 새 목표 시작" (항상 목록 최상단)
- [ ] 리스트 항목: 목표명, 마지막 수정일, 진행 단계 배지(행동모으기/1판·영향력/2판·능력/겹쳐보기 4종), 황금 행동 개수
- [ ] 리스트 항목 클릭 시 해당 세션 로드 + 현재 활성 항목 시각적 강조(예: 좌측 바 또는 배경색)
- [ ] 리스트 항목별 삭제 버튼
- [ ] 빈 상태: 저장된 목표가 없을 때 안내 문구 ("아직 저장된 목표가 없습니다" 등)

#### FocusMap 탭 — 겹쳐 보기 결과 화면 (기존 §5.4 화면에 추가)

- [ ] 결과 표 각 행에 체크박스 (이미 `addedTaskIds`에 있는 항목은 체크 해제 불가 + "추가됨" 라벨로 대체)
- [ ] 버튼: "선택 항목 할일로 추가" (선택 0개면 비활성화)
- [ ] 변환 완료 후 상태 메시지 (예: "2개를 할일로 추가했습니다")

---

## 6. Error Handling

### 6.1 Error Code Definition

기존 `tasks.js`/`schedules.js`와 동일하게 `{ error: string }` 포맷을 유지한다 (템플릿의 `code`/`details` 구조는 이 프로젝트에 신설하지 않음).

| Status | 상황 | 메시지 |
|--------|------|--------|
| 400 | goal 누락/공백으로 생성·수정 시도 | `목표를 입력해주세요.` |
| 404 | 존재하지 않는 id로 조회/수정/삭제 | `찾을 수 없습니다.` |
| 409 | 이미 존재하는 goal로 생성 또는 다른 세션과 중복되게 goal 변경 | `이미 저장된 목표입니다.` |
| 500 | 예상 못한 서버 오류 | 기존 `index.js` 공통 에러 핸들러가 처리 (변경 없음) |

### 6.2 Error Response Format

```json
{ "error": "이미 저장된 목표입니다." }
```

---

## 7. Security Considerations

로컬 단일 사용자 앱으로 외부 노출/인증이 없는 기존 구조를 그대로 유지한다.

- [ ] 입력 검증: `goal`은 trim 후 빈 문자열 여부만 검사 (XSS는 React 기본 이스케이프에 의존, 기존과 동일)
- [ ] SQL Injection: 기존과 동일하게 `db.prepare().run(...)` 파라미터 바인딩만 사용, 문자열 concat 금지
- [ ] Rate Limiting / HTTPS: 해당 없음 (localhost 전용, 기존과 동일)

---

## 8. Test Plan

### 8.1 Test Scope

이 프로젝트는 Playwright 등 자동화 테스트 도구가 설치되어 있지 않다 (기존 focusmap MVP 구현 때도 동일). 따라서 Do 단계에서도 자동 테스트 코드 대신 **수동 시나리오 검증**으로 대체한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API 확인 | 5개 엔드포인트 — 상태 코드/응답 형태 | `curl` 수동 실행 | Do |
| L2: UI 동작 확인 | §5.4 체크리스트 요소 | 브라우저 수동 조작 (claude-in-chrome 등) | Do |
| L3: E2E 시나리오 | 목표 전환, 할일 변환 후 재방문 | 브라우저 수동 조작 | Do/Check |

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | 설명 | 기대 상태 | 기대 응답 |
|---|----------|--------|------|:--------:|-----------|
| 1 | `/api/focusmap` | GET | 빈 상태 조회 | 200 | `[]` |
| 2 | `/api/focusmap` | POST | goal 없이 생성 시도 | 400 | `.error` 존재 |
| 3 | `/api/focusmap` | POST | 정상 생성 | 201 | `.id` 존재, `.goal` 일치 |
| 4 | `/api/focusmap` | POST | 동일 goal 재생성 시도 | 409 | `.error` 존재 |
| 5 | `/api/focusmap/:id` | GET | 생성한 세션 조회 | 200 | `.items`가 배열 |
| 6 | `/api/focusmap/:id` | PUT | step/cursor/addedTaskIds 갱신 | 200 | 갱신 값 반영 |
| 7 | `/api/focusmap/:id` | DELETE | 삭제 | 204 | 이후 GET 시 404 |
| 8 | `/api/focusmap/:id` | GET | 없는 id 조회 | 404 | `.error` 존재 |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | FocusMap 탭 | 로드 | 좌측 목록에 §5.4 요소 전부 표시 | 저장된 목표 있으면 표시, 없으면 빈 상태 문구 |
| 2 | FocusMap 탭 | "새 목표 시작" 클릭 | 0단계 빈 편집 화면 진입, 좌측 목록 선택 해제 | activeId = null |
| 3 | FocusMap 탭 | 좌측 목록 항목 클릭 | 해당 세션이 저장 당시 단계로 로드 | `GET /api/focusmap/:id` 응답과 화면 일치 |
| 4 | FocusMap 탭 | 좌측 목록 삭제 클릭 | 목록에서 제거, 활성 세션이었다면 편집 화면도 초기화 | `DELETE` 호출 후 목록 재조회 |
| 5 | 겹쳐 보기 화면 | 항목 체크 후 "선택 항목 할일로 추가" 클릭 | 일정관리 탭 할일 목록에 해당 항목 등장, 결과 표에 "추가됨" 표시 | `GET /api/tasks`에 새 항목 존재 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 목표 2개 전환 | 목표A 완료저장 → 새 목표 시작 → 목표B 진행 중 저장 → 좌측에서 목표A 클릭 | 목표A가 겹쳐보기 결과 그대로 복원, 목표B는 목록에 별도로 남음 |
| 2 | 할일 변환 후 재방문 | 목표A 겹쳐보기에서 항목 2개 선택 → 할일 추가 → 새로고침 → 목표A 다시 열람 | 2개 항목이 "추가됨" 상태 유지, 일정관리 탭에도 여전히 존재 |

### 8.5 Seed Data Requirements

없음 — Do/Check 단계에서 수동으로 목표 1~2개를 생성해 검증한다.

---

## 9. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다 (Next.js/DI 컨테이너 등은 도입하지 않음).

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/이벤트 처리 | `client/src/components/FocusMap/` |
| **Application (Hooks)** | 세션/목록 로드·생성·저장·삭제 오케스트레이션 | `client/src/hooks/useFocusMap.js`, `useFocusMapList.js` |
| **Infrastructure** | HTTP 통신, DB 접근 | `client/src/api/focusMap.js`, `server/routes/focusmap.js` |
| **Domain** | 세션 JSON 구조 (§3.1) | 별도 타입 파일 없이 JSDoc으로 문서화 (프로젝트가 순수 JS이므로 타입 파일 신설 안 함) |

### 9.2 Dependency Rules

```
컴포넌트(Presentation) ──▶ 훅(Application) ──▶ api 모듈(Infrastructure) ──▶ fetch
훅은 컴포넌트를 import하지 않는다 (단방향, 기존 useTasks/useSchedules와 동일한 규칙)
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `FocusMap.jsx` | Presentation | `client/src/components/FocusMap/FocusMap.jsx` |
| `FocusMapList.jsx` | Presentation | `client/src/components/FocusMap/FocusMapList.jsx` |
| `useFocusMap` | Application | `client/src/hooks/useFocusMap.js` |
| `useFocusMapList` | Application | `client/src/hooks/useFocusMapList.js` |
| `api/focusMap.js` | Infrastructure | `client/src/api/focusMap.js` |
| `routes/focusmap.js` | Infrastructure | `server/routes/focusmap.js` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다 (신규 규칙 없음): 컴포넌트 PascalCase, 훅 `useXxx` camelCase, 함수 camelCase, 폴더는 기능 단위 PascalCase(`FocusMap/`).

### 10.2 Import Order

기존 파일들의 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다. 이 프로젝트에는 강제 ESLint/Prettier 설정이 없다.

### 10.3 Environment Variables

신규 환경변수 없음 — 기존 `PORT`, `DB_PATH`를 재사용한다.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 리소스당 파일 수 | API 1파일(`focusMap.js`) + 라우트 1파일(`focusmap.js`)에 전체 CRUD, `tasks.js`/`schedules.js`와 동일 |
| 상태 관리 | 로컬 React state + custom hook, 전역 스토어 도입 안 함 |
| 에러 처리 | `{ error: string }` 한국어 메시지, 기존 라우트와 동일 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
server/
├── db/schema.sql                      (수정 — focus_map 테이블 재정의)
├── routes/focusmap.js                 (수정 — 5개 엔드포인트로 확장)
client/src/
├── api/focusMap.js                    (수정 — list/fetch/create/save/delete 5개 함수로 재작성)
├── hooks/
│   ├── useFocusMap.js                 (수정 — id 기반 활성 세션 훅으로 재작성)
│   └── useFocusMapList.js             (신규 — 목록 조회/삭제)
└── components/FocusMap/
    ├── FocusMap.jsx                   (수정 — 좌우 레이아웃 컨테이너 + 결과화면 체크박스/변환 버튼)
    └── FocusMapList.jsx               (신규 — 좌측 사이드바)
```

### 11.2 Implementation Order

1. [ ] `server/db/schema.sql` — `focus_map` 테이블 재정의 (`goal UNIQUE`)
2. [ ] `server/routes/focusmap.js` — `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` 구현
3. [ ] `client/src/api/focusMap.js` — 5개 함수로 재작성
4. [ ] `client/src/hooks/useFocusMapList.js` — 신규 작성
5. [ ] `client/src/hooks/useFocusMap.js` — id 인자를 받도록 재작성, "0단계는 로컬 초안" 로직 반영 (§2.2 Data Flow 참조)
6. [ ] `client/src/components/FocusMap/FocusMapList.jsx` — 신규 작성
7. [ ] `client/src/components/FocusMap/FocusMap.jsx` — 레이아웃 재구성 + 체크박스/할일 변환 버튼 연동 (기존 `useTasks().addTask` 재사용, `App.jsx` 수정은 최소화)
8. [ ] §8.2~8.4 수동 시나리오 검증

### 11.3 Session Guide

> Session 1(Plan+Design)은 본 문서로 완료. `/pdca do focusmap-goals --scope module-N`으로 모듈별 구현 가능.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---:|
| 백엔드 (스키마+API) | `module-1` | `schema.sql`, `routes/focusmap.js` | 8-10 |
| 클라이언트 데이터층 | `module-2` | `api/focusMap.js`, `useFocusMap.js`, `useFocusMapList.js` | 8-10 |
| UI (좌측 목록 + 레이아웃) | `module-3` | `FocusMapList.jsx`, `FocusMap.jsx` 레이아웃 부분 | 10-12 |
| 할일 변환 연동 | `module-4` | 겹쳐보기 체크박스 + `tasks` 연동 부분 | 6-8 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 (본 문서) |
| Session 2 | Do | `--scope module-1,module-2` | 20-25 |
| Session 3 | Do | `--scope module-3,module-4` | 20-25 |
| Session 4 | Check + Report | 전체 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-04 | Initial draft (Option C 선택) | Mincoln Cho |
