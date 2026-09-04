---
template: design
version: 1.0
---

# schedule-weekly-view Design Document

> **Summary**: 일정관리 탭에 "일간/주간" 내부 뷰 전환을 추가하고, 주간 뷰에서는 일~토 7일의 스케줄을 요일별 컬럼 타임라인으로 한눈에 보여주는(읽기 전용) 기능의 설계
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-04
> **Status**: Draft
> **Planning Doc**: [schedule-weekly-view.plan.md](../../01-plan/features/schedule-weekly-view.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline(schema.md/conventions.md 등)을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 일정관리가 하루 단위 조회만 지원해 주간 단위 회고("이번 주 어떻게 살았나")가 불가능함 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 하루 계획을 세우고, 주기적으로 한 주를 돌아보고 싶은 사람 |
| **RISK** | 서버 API가 날짜 단위 조회만 지원해 주간 뷰가 7번의 병렬 호출에 의존함 |
| **SUCCESS** | 일정관리 탭에서 "주간" 뷰로 전환하면 일~토 7일의 스케줄이 요일별로 한 화면에 보이고, 요일을 클릭하면 해당 날짜의 기존 일간 뷰로 이동한다 |
| **SCOPE** | (1) 일정관리 내부 뷰 전환 탭 (2) 주간 스케줄 조회 훅 (3) 주간 타임라인 그리드 UI (4) 주 단위 이동 (5) 요일 클릭 시 일간 뷰 딥링크 |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 1. Overview

### 1.1 Design Goals

- 기존 일간 뷰(DnD, 할일 백로그, 24시간 타임라인)를 한 줄도 바꾸지 않고 그대로 유지한다.
- 서버 API·스키마를 신설하지 않고, 기존 `GET /api/schedules?date=`를 재사용해 주간 뷰를 구성한다.
- 데일리노트(`DailyNote.jsx`)의 뷰 전환 pill UI/UX를 그대로 재사용해 사용자가 이미 익숙한 패턴으로 새 뷰를 발견하게 한다.
- 신규 npm 의존성(캘린더/스케줄러 라이브러리)을 도입하지 않고 `DayTimeline.jsx`의 절대 포지셔닝 방식을 그대로 확장한다.

### 1.2 Design Principles

- **컨벤션 재사용**: 뷰 전환 pill은 `DailyNote.jsx`의 `VIEWS` 배열 + 버튼 스타일을 그대로 복제한다. 요일 헤더 색상(일/토 빨강)과 "오늘" 강조는 `DailyNoteCalendarView.jsx`의 규칙을 그대로 따른다.
- **단순함 우선**: 주간 뷰는 조회 전용이다 — 편집·삭제·DnD·상태 변경 UI를 두지 않는다. 요일을 클릭하면 이미 검증된 일간 뷰로 보내 편집은 거기서 하게 한다.
- **기존 기능 무변경**: `App.jsx`의 `tab === 'schedule'` 블록 안에서만 변경이 일어나며, `useSchedules(date)`/`DayTimeline`/`TimeGrid`/`TaskBacklog`/`DateNavigator`는 로직·props 변경 없이 재사용한다.

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | `App.jsx`에 주간 그리드 JSX를 인라인으로 직접 작성 | `WeekTimeline/` 폴더로 세분화(헤더/컬럼/네비게이터 별도 컴포넌트 + 별도 컨텍스트) | `WeekTimeline.jsx` 1개 컴포넌트(헤더+네비게이션+7컬럼 그리드 포함) + `useWeekSchedules.js` 1개 훅 |
| **New Files** | 0 (App.jsx만 비대해짐) | 5+ | 2 |
| **Modified Files** | 1 (`App.jsx`) | 1 (`App.jsx`) | 1 (`App.jsx`) |
| **Complexity** | Low (App.jsx가 더 비대해짐) | High (규모 대비 과설계 — 이 기능은 CRUD도 없고 뷰도 1개뿐) | Medium |
| **Maintainability** | Low | High (파편화로 오히려 추적 어려움) | High |
| **Effort** | Low | High | Medium |
| **Risk** | Medium (`App.jsx`가 이미 여러 탭 로직을 갖고 있어 더 커지면 가독성 저하) | Low (구조는 깔끔하나 이 규모엔 과함) | Low |
| **Recommendation** | Quick wins | Long-term projects | **Default choice** |

**Selected**: **Option C — Pragmatic Balance**
**Rationale**: 이 기능은 데일리노트처럼 3개의 서로 다른 뷰(목록/캘린더/마인드맵)를 갖지 않고 "주간 그리드" 뷰 1개만 추가한다. `DayTimeline.jsx`(단일 컬럼 타임라인)를 7컬럼으로 확장하는 정도의 복잡도이므로, `DayTimeline.jsx` 하나가 그 역할을 전담하듯 `WeekTimeline.jsx` 하나로 헤더+네비게이션+그리드를 전담시키는 것이 적정 규모다. 네비게이션(이전/다음/이번 주)까지 별도 컴포넌트로 쪼개면(`DateNavigator.jsx`가 별도 파일인 것과 달리) 이 기능 규모에서는 파일만 늘고 재사용처가 없다.

> 아래 상세 설계는 Option C를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ App.jsx — tab === 'schedule'                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [일간] [주간]   ← 뷰 전환 pill (DailyNote.jsx VIEWS 패턴)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  scheduleView === 'daily'                 scheduleView === 'weekly'│
│  ┌──────────────────────────┐             ┌───────────────────┐  │
│  │ DndContext                │             │ WeekTimeline.jsx  │  │
│  │  DateNavigator             │             │  (자체 상태: weekStart)│
│  │  TaskBacklog               │             │  useWeekSchedules  │  │
│  │  TimeGrid                  │             │   → GET /api/schedules?date=  ×7 (병렬) │
│  │  DayTimeline                │             │  요일 클릭 → onSelectDate(date) │
│  │ (기존 그대로, 변경 없음)      │             └─────────┬─────────┘  │
│  └──────────────────────────┘                       │            │
│                                          setDate(date) + setScheduleView('daily')│
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
"주간" pill 클릭 → scheduleView='weekly' → WeekTimeline 마운트
  → 오늘이 포함된 주(일요일 시작)의 weekStart 계산 → useWeekSchedules(weekStart) 실행
  → 7개 날짜 각각에 대해 fetchSchedules(date) 병렬 호출(Promise.all) → { [date]: schedules[] } 맵 구성
  → 7개 컬럼에 요일별로 렌더링(DayTimeline과 동일한 절대 포지셔닝 + STATUS_STYLE)

"◀"/"▶" 클릭 → weekStart를 ±7일 이동 → useWeekSchedules 재실행(의존성 배열의 weekStart 변경으로 자동 재조회)
"이번 주" 클릭 → weekStart를 오늘 기준으로 재계산

요일 헤더 클릭 → onSelectDate(date) 호출 → App.jsx가 setDate(date) + setScheduleView('daily') 실행 → 일간 뷰로 전환되어 해당 날짜 표시
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `App.jsx` (`tab==='schedule'` 블록) | `useWeekSchedules` 없음(직접 호출 안 함), `WeekTimeline` | 뷰 전환 상태(`scheduleView`) 보유 + 일간/주간 분기 렌더 |
| `WeekTimeline.jsx` | `useWeekSchedules`, `api/schedules.js`의 `fetchSchedules`(간접, 훅을 통해) | 주 단위 네비게이션 + 7컬럼 그리드 렌더, 요일 클릭 시 상위로 날짜 전달 |
| `useWeekSchedules.js` | `api/schedules.js`의 `fetchSchedules` | 주의 7일치 스케줄을 병렬 조회해 날짜별 맵으로 반환 |

---

## 3. Data Model

신규 스키마·테이블·API 없음 — 기존 `schedules` 컬렉션(Firestore, `docs/guides/firebase-firestore-integration.md` 참고)의 문서 shape을 그대로 사용한다.

### 3.1 Entity Definition (기존 재사용, 참고용)

```
Schedule (기존, 변경 없음)
{
  id: number,
  title: string,
  date: string,        // "YYYY-MM-DD"
  start_min: number,   // 0~1440
  end_min: number,
  status: 'planned' | 'in_progress' | 'done' | 'skipped',
  created_at: string,
}
```

### 3.2 클라이언트 파생 데이터 (신규, 서버에 저장하지 않음)

```
WeekSchedules  // useWeekSchedules(weekStart)의 반환값, 컴포넌트 로컬 메모리에만 존재
{
  loading: boolean,
  schedulesByDate: {
    "2026-09-07": Schedule[],  // 일
    "2026-09-08": Schedule[],  // 월
    ...                        // 총 7개 키, weekStart부터 +6일까지
  }
}
```

### 3.3 Database Schema

변경 없음 — 이 기능은 서버/DB 코드를 전혀 건드리지 않는다(§7.2 아키텍처 결정 참고).

---

## 4. API Specification

신규 엔드포인트 없음. 기존 `GET /api/schedules?date=YYYY-MM-DD`(응답: 해당 날짜 스케줄 배열)를 `useWeekSchedules`가 7번 병렬 호출하는 방식으로 재사용한다. 상세 스펙은 기존 `server/routes/schedules.js` 그대로.

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [일정관리] [포커스맵] ... (기존 App.jsx 상단 탭, 변경 없음)          │
├─────────────────────────────────────────────────────────────────┤
│ [일간] [주간]                                                     │  ← 신규: 뷰 전환 pill
├─────────────────────────────────────────────────────────────────┤
│ (scheduleView==='daily' 이면 기존 레이아웃 그대로)                   │
│  ┌───────────────┬───────────────────────────────────┐          │
│  │ DateNavigator │                                     │          │
│  │ TaskBacklog   │        DayTimeline (24h)             │          │
│  │ TimeGrid      │                                     │          │
│  └───────────────┴───────────────────────────────────┘          │
│                                                                   │
│ (scheduleView==='weekly' 이면 WeekTimeline)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ◀   2026-09-07 ~ 2026-09-13   ▶   [이번 주]                 │  │
│  ├───────┬───────┬───────┬───────┬───────┬───────┬───────────┤  │
│  │ 일 9/7 │ 월 9/8 │ 화 9/9 │ 수 9/10│ 목 9/11│ 금 9/12│ 토 9/13   │  │
│  ├───────┼───────┼───────┼───────┼───────┼───────┼───────────┤  │
│  │  (세로 24시간 축 위에 각 날짜의 스케줄 블록, 상태별 색상)         │  │
│  │  09:00 ▓ 회의                                                 │  │
│  │  10:00        ▓ 운동                                          │  │
│  │  ...                                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 User Flow

```
일정관리 탭 진입 → 기본 [일간] 뷰(기존과 동일)
  └─ [주간] pill 클릭 → 오늘이 포함된 주 로드(일~토) → 7컬럼 타임라인 표시
        ├─ "◀"/"▶" 클릭 → 이전/다음 주로 이동, 재조회
        ├─ "이번 주" 클릭 → 오늘 기준 주로 즉시 복귀
        └─ 요일 헤더(또는 그 날짜 컬럼 배경) 클릭 → [일간] 뷰로 전환 + 해당 날짜 선택된 상태로 표시
              → 사용자는 여기서 기존과 동일하게 편집(DnD, 상태 변경 등) 수행
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `App.jsx` (수정) | `client/src/` | `scheduleView` state(`'daily' | 'weekly'`) 보유, pill 렌더, 두 뷰 분기 |
| `WeekTimeline.jsx` (신규) | `client/src/components/` | 주 단위 네비게이션(`weekStart` 로컬 state) + 7컬럼 그리드 렌더 + 요일 클릭 콜백 |
| `useWeekSchedules.js` (신규) | `client/src/hooks/` | `weekStart` 기준 7일 스케줄 병렬 조회, `{ loading, schedulesByDate }` 반환 |

### 5.4 Page UI Checklist

#### 공통 (App.jsx)

- [ ] 일정관리 탭 상단에 `[일간] [주간]` pill — `DailyNote.jsx`의 `VIEWS` 버튼과 동일한 클래스(`bg-gray-100 rounded p-1` 컨테이너, 선택 시 `bg-white text-blue-600 shadow`)
- [ ] 기본값은 `'daily'`, 탭을 벗어났다 돌아와도(같은 세션 내) 마지막 선택 유지(App state이므로 자동 유지됨, 별도 처리 불필요)
- [ ] `scheduleView === 'daily'`일 때만 기존 `<DndContext>` 블록 렌더(주간 뷰는 DnD 컨텍스트 불필요)

#### 주간 타임라인 (WeekTimeline.jsx)

- [ ] 상단 네비게이션: `◀` / `"YYYY-MM-DD ~ YYYY-MM-DD"` 범위 텍스트 / `▶` / `이번 주` 버튼 (버튼 스타일은 `DateNavigator.jsx`/`DailyNoteCalendarView.jsx`의 월 이동 버튼과 동일하게 `px-3 py-1 rounded bg-gray-100 hover:bg-gray-200`)
- [ ] `weekStart`는 항상 일요일로 정규화(로컬 `Date.getDay()` 기준 계산), 마운트 시 오늘이 포함된 주로 초기화
- [ ] 요일 헤더 7칸 — 요일명(`일`~`토`) + `MM/DD`, 일요일/토요일은 빨간 계열 텍스트(`DailyNoteCalendarView.jsx`의 `WEEKDAYS` 규칙 재사용), 오늘 날짜 컬럼은 헤더에 파란색 굵게 표시(`text-blue-600 font-bold`, 기존 캘린더 뷰의 오늘 강조 규칙과 동일 톤)
- [ ] 각 요일 컬럼: 세로 24시간 축(`DayTimeline.jsx`의 `HOUR_HEIGHT` 절대 포지셔닝 로직 재사용, 단 7분할 폭에 맞춰 `WEEK_HOUR_HEIGHT`를 더 작게 설정 — 예: 32px/시간, 총 768px)
- [ ] 각 스케줄 블록: 상태별 색상은 `DayTimeline.jsx`의 `STATUS_STYLE`과 동일 팔레트 재사용. 컬럼 폭이 좁으므로 블록 안에는 제목만 1줄 truncate로 표시(시작/종료 시각 텍스트는 생략 — 데일리 뷰에서 이미 볼 수 있음)
- [ ] 로딩 중(주 이동 직후 등)에는 그리드 자리에 간단한 로딩 문구(`불러오는 중...`, 기존 `DailyNote.jsx`의 `!loaded` 처리와 동일 톤) 표시
- [ ] 요일 헤더 전체(또는 컬럼 상단 영역) 클릭 시 `onSelectDate(date)` 호출 — 커서를 `cursor-pointer`로 표시해 클릭 가능함을 암시
- [ ] 스케줄이 없는 날짜의 컬럼은 빈 채로(안내 문구 없이) 표시 — 7칸이 나란히 있어 "비어 있음"이 시각적으로 이미 명확함
- [ ] 블록 클릭/드래그로 아무 동작도 하지 않음(조회 전용 — 이벤트 핸들러 자체를 두지 않아 자연스럽게 강제됨)

### 5.5 Week Range Calculation

```js
function startOfWeek(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0=일요일
  return toDateString(d); // 기존 App.jsx/Calendar 등에서 쓰는 것과 동일한 로컬 포맷터
}
function weekDates(weekStartStr) {
  const start = new Date(weekStartStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateString(d);
  });
}
```

`toDateString`은 기존 프로젝트 관례(각 파일이 로컬로 동일 함수를 복제 — `App.jsx`, `Calendar.jsx`, `DailyNoteCalendarView.jsx`에 이미 각각 존재)를 따라 `WeekTimeline.jsx` 안에도 로컬로 둔다(§9.4 참고).

---

## 6. Error Handling

### 6.1 Error Code Definition

신규 API가 없으므로 신규 에러 코드도 없다. `fetchSchedules(date)` 호출 중 하나라도 실패하면(네트워크 오류 등) `useWeekSchedules`는 해당 실패를 콘솔에 로그하고 그 날짜의 스케줄을 빈 배열로 처리해 나머지 6일 렌더링에 영향을 주지 않는다(Promise.allSettled 사용).

### 6.2 Error Response Format

해당 없음(신규 API 없음).

---

## 7. Security Considerations

로컬 단일 사용자 앱으로 외부 노출/인증이 없는 기존 구조를 그대로 유지한다. 신규 API·입력 필드가 없어 추가 검증 대상도 없다.

---

## 8. Test Plan

### 8.1 Test Scope

이 프로젝트는 자동화 테스트 도구가 설치되어 있지 않으므로, Do 단계에서도 **수동 시나리오 검증**으로 대체한다. 신규 API가 없으므로 L1(API 테스트)은 생략하고 L2/L3만 수행한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L2: UI 동작 확인 | §5.4 체크리스트 요소 | 브라우저 수동 조작 (claude-in-chrome 등) | Do |
| L3: E2E 시나리오 | 뷰 전환 + 주 이동 + 딥링크 교차 확인 | 브라우저 수동 조작 | Do/Check |

### 8.2 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | 일정관리 탭 | "주간" pill 클릭 | 오늘이 포함된 주(일~토)가 표시됨 | 헤더 날짜 범위에 오늘 포함 |
| 2 | 주간 뷰 | "◀" 클릭 | 이전 주로 이동, 헤더 범위 갱신 | 날짜 범위가 정확히 -7일 |
| 3 | 주간 뷰 | "▶"을 여러 번 클릭 후 "이번 주" 클릭 | 오늘이 포함된 주로 즉시 복귀 | 헤더 범위에 오늘 포함 |
| 4 | 주간 뷰 | 스케줄이 있는 날짜의 블록 확인 | 상태별 색상(예정/진행중/완료)이 일간 뷰와 동일하게 표시 | 일간 뷰에서 같은 날짜 확인 시 색상 일치 |
| 5 | 주간 뷰 | 요일 헤더 클릭 | "일간" 뷰로 전환되고 그 날짜가 선택됨 | `DateNavigator`에 해당 날짜 표시 |
| 6 | 일간 뷰 | 기존 DnD로 스케줄 추가 후 "주간" 전환 | 방금 추가한 스케줄이 해당 요일 컬럼에 표시 | 없음 |

### 8.3 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 회귀 없음 확인 | 일간 뷰에서 스케줄 추가/상태변경/삭제(DnD 포함)를 기존과 동일하게 수행 | 모든 동작이 이번 변경 이전과 동일하게 작동 |
| 2 | 주간 개요 확인 | 한 주에 걸쳐 요일마다 스케줄을 1~2개씩 등록 → 주간 뷰 전환 | 7개 컬럼 모두에 등록한 스케줄이 올바른 요일/시간대에 표시 |
| 3 | 딥링크 왕복 | 주간 뷰에서 특정 요일 클릭 → 일간 뷰에서 그 날짜 스케줄 수정 → 다시 "주간" 전환 | 수정 내용이 주간 뷰에도 즉시 반영 |

### 8.4 Seed Data Requirements

없음 — Do/Check 단계에서 수동으로 서로 다른 요일에 스케줄을 몇 건 등록해 검증한다.

---

## 9. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다.

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/이벤트 처리 | `client/src/App.jsx`(뷰 전환 분기), `client/src/components/WeekTimeline.jsx` |
| **Application (Hooks)** | 주간 스케줄 병렬 조회 오케스트레이션 | `client/src/hooks/useWeekSchedules.js` |
| **Infrastructure** | HTTP 통신 | `client/src/api/schedules.js`(기존 `fetchSchedules` 재사용, 변경 없음) |
| **Domain** | 없음(신규 엔티티 없음) — 기존 Schedule shape 재사용 | — |

### 9.2 Dependency Rules

```
WeekTimeline.jsx(Presentation) ──▶ useWeekSchedules(Application) ──▶ fetchSchedules(Infrastructure) ──▶ fetch
훅은 컴포넌트를 import하지 않는다 (단방향, 기존 useSchedules와 동일한 규칙)
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `App.jsx` (수정) | Presentation | `client/src/App.jsx` |
| `WeekTimeline.jsx` | Presentation | `client/src/components/WeekTimeline.jsx` |
| `useWeekSchedules` | Application | `client/src/hooks/useWeekSchedules.js` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다: 컴포넌트 PascalCase, 훅 `useXxx` camelCase. `DateNavigator.jsx`/`DayTimeline.jsx`처럼 이 영역은 전용 폴더 없이 `components/` 바로 아래 loose 파일로 둔다(기존 관례 — 일정관리 관련 보조 컴포넌트들이 이미 이렇게 배치되어 있음).

### 10.2 Import Order

기존 파일들의 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다.

### 10.3 Environment Variables

신규 환경변수 없음.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 파일 배치 | `WeekTimeline.jsx`는 `DateNavigator.jsx`/`DayTimeline.jsx`와 동일하게 `components/` 바로 아래 loose 파일로 배치(전용 폴더 만들지 않음 — 신규 컴포넌트가 1개뿐이라 폴더화가 과함) |
| 날짜 유틸 | `toDateString`/`startOfWeek`/`weekDates`를 `WeekTimeline.jsx`에 로컬로 정의(기존 프로젝트가 이미 여러 파일에서 `toDateString`을 각자 정의해온 관례를 따름 — daily-idea-note Design §10.4와 동일 원칙) |
| 색상/스타일 재사용 | `DayTimeline.jsx`의 `STATUS_STYLE` 객체를 import하지 않고 동일한 값으로 로컬 복제(기존 컨벤션 — 공용 유틸 추출보다 파일별 로컬 중복을 선호) |
| 상태 관리 | 로컬 React state + custom hook, 전역 스토어 도입 안 함 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
client/src/
├── App.jsx                     (수정 — scheduleView state 추가, tab==='schedule' 블록에 pill+분기 추가)
├── hooks/
│   └── useWeekSchedules.js     (신규 — 주 7일 스케줄 병렬 조회)
└── components/
    └── WeekTimeline.jsx        (신규 — 주 네비게이션 + 7컬럼 타임라인 그리드)
```

기존 `DateNavigator.jsx`, `DayTimeline.jsx`, `TimeGrid/`, `TaskBacklog/`, `api/schedules.js`, `hooks/useSchedules.js`, 서버 전체는 변경 없음.

### 11.2 Implementation Order

1. [ ] `client/src/hooks/useWeekSchedules.js` — `weekStart` 인자를 받아 7일치 `fetchSchedules`를 `Promise.allSettled`로 병렬 호출, `{ loading, schedulesByDate }` 반환
2. [ ] `client/src/components/WeekTimeline.jsx` — 네비게이션(◀/▶/이번 주) + `weekStart` 로컬 state + 7컬럼 그리드(§5.5 날짜 계산, `DayTimeline.jsx` 스타일 재사용) + `onSelectDate` prop 호출
3. [ ] `client/src/App.jsx` — `scheduleView` state(`'daily'` 기본값) 추가, 기존 `tab==='schedule'` 내부 레이아웃을 `scheduleView==='daily'` 조건으로 감싸고, pill UI 추가, `scheduleView==='weekly'`일 때 `<WeekTimeline onSelectDate={(d) => { setDate(d); setScheduleView('daily'); }} />` 렌더
4. [ ] §8.2~8.3 수동 시나리오 검증

### 11.3 Session Guide

> 이 기능은 신규 파일 2개 + 기존 파일 1개 수정뿐인 소규모 변경이라 단일 세션(Do)으로 충분하다. 별도 모듈 분할은 불필요.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-04 | Initial draft (Option C 선택) | Mincoln Cho |
