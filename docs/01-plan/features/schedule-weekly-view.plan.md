---
template: plan
version: 1.0
---

# schedule-weekly-view Planning Document

> **Summary**: 일정관리 화면에 "일간/주간" 내부 탭을 추가하고, 주간 탭에서는 일주일(일~토) 스케줄을 한눈에 볼 수 있는 읽기 전용 타임라인 그리드를 제공한다. 기존 일간 뷰(할일 백로그 + 시간 그리드 + 24시간 타임라인)는 그대로 유지한다.
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-04
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 일정관리는 하루 단위로만 조회할 수 있어, "이번 주를 어떻게 보냈는지/어떻게 보낼지"를 파악하려면 날짜를 하루씩 넘겨가며 여러 번 확인해야 한다 |
| **Solution** | 일정관리 탭 내부에 "일간/주간" 뷰 전환 탭을 추가하고(데일리노트의 뷰 전환 UI/UX 재사용), 주간 뷰에서는 일~토 7일치 스케줄을 요일별 컬럼으로 나란히 배치한 읽기 전용 타임라인 그리드로 보여준다 |
| **Function/UX Effect** | 하루씩 넘겨보지 않아도 일주일 전체의 시간 배분과 상태(예정/진행중/완료)를 한 화면에서 파악할 수 있고, 특정 요일을 클릭하면 기존 일간 뷰로 바로 이동해 편집을 이어갈 수 있다 |
| **Core Value** | 기존 일간 워크플로(할일 배치, 상태 변경)를 전혀 건드리지 않으면서, "일주일 회고"라는 새로운 관점을 추가해 시간 계획의 완결성을 높인다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 일정관리가 하루 단위 조회만 지원해 주간 단위 회고("이번 주 어떻게 살았나")가 불가능함 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 하루 계획을 세우고, 주기적으로 한 주를 돌아보고 싶은 사람 |
| **RISK** | 서버 API가 날짜 단위 조회만 지원해 주간 뷰가 7번의 병렬 호출에 의존함(신규 API 없이 처리 가능한지가 설계의 핵심) |
| **SUCCESS** | 일정관리 탭에서 "주간" 뷰로 전환하면 일~토 7일의 스케줄이 요일별로 한 화면에 보이고, 요일을 클릭하면 해당 날짜의 기존 일간 뷰로 이동한다 |
| **SCOPE** | (1) 일정관리 내부 뷰 전환 탭(일간/주간) (2) 주간 스케줄 조회 훅 (3) 주간 타임라인 그리드 UI (4) 주 단위 이동(이전 주/다음 주/이번 주) (5) 요일 클릭 시 일간 뷰 딥링크 |

---

## 1. Overview

### 1.1 Purpose

일정관리 탭 안에 "일간/주간" 뷰 전환 탭을 추가한다. 기존 일간 뷰(할일 백로그 + 시간 그리드 + 24시간 타임라인, DnD 포함)는 완전히 그대로 유지하고, 새로 추가하는 주간 뷰는 한 주(일~토) 7일의 스케줄을 요일별 컬럼으로 나란히 배치해 한눈에 볼 수 있는 **읽기 전용** 타임라인을 제공한다.

### 1.2 Background

현재 일정관리는 `DateNavigator`로 하루씩만 이동하며 그날의 할일/시간 그리드/24시간 타임라인(`DayTimeline`)을 보여준다. 사용자 요청에 따라 다음을 확정한다:

- 기존 데일리(일간) 뷰는 **완전히 유지** — 새 기능은 "일정관리 안의 별도 탭"으로만 추가한다.
- 뷰 전환 UI/UX는 **데일리노트(`DailyNote.jsx`)의 뷰 전환 패턴을 참고**한다 — 상단에 목록/캘린더/마인드맵 같은 pill 버튼 그룹으로 뷰를 전환하는 방식을 "일간/주간" 2개로 그대로 적용한다.
- 주간 뷰의 핵심은 "한눈에 일주일 동안 어떤 스케줄로 살았는지" 보는 것 — 즉 조회/회고 목적이며, 이번 스코프에서는 편집·DnD는 포함하지 않는다(§2.2 참고).

### 1.3 Related Documents

- 뷰 전환 탭 UI/UX 선례: `client/src/components/DailyNote/DailyNote.jsx`의 `VIEWS` 배열 + pill 버튼 그룹(`bg-gray-100 rounded p-1` 컨테이너 + 선택 시 `bg-white text-blue-600 shadow`)
- 주 단위 네비게이션 UI 선례: `client/src/components/DailyNote/DailyNoteCalendarView.jsx`의 월 이동 헤더(◀ / 레이블 / ▶) 및 요일 헤더(`WEEKDAYS = ['일','월',...]`, 일/토 빨간색 표기)
- 시간 블록 시각화 선례: `client/src/components/DayTimeline.jsx`의 `HOUR_HEIGHT` 기반 절대 포지셔닝 + `STATUS_STYLE`(예정/진행중/완료 색상)
- 날짜 이동 버튼 스타일 선례: `client/src/components/DateNavigator.jsx`
- 스케줄 데이터 훅 선례: `client/src/hooks/useSchedules.js` (날짜 단위 조회, `GET /api/schedules?date=`)

---

## 2. Scope

### 2.1 In Scope

- [ ] 일정관리 탭 상단에 "일간/주간" 뷰 전환 pill 버튼 추가 (데일리노트 `VIEWS` 패턴 재사용)
- [ ] 기존 일간 뷰(DateNavigator + TaskBacklog + TimeGrid + DayTimeline + DnD)는 "일간" 뷰로 그대로 이동, 동작 변경 없음
- [ ] 신규 `useWeekSchedules(weekStartDate)` 훅 — 주의 7개 날짜에 대해 기존 `fetchSchedules(date)`를 병렬 호출해 날짜별 스케줄 맵을 만든다 (신규 서버 API 없음)
- [ ] 신규 주간 타임라인 그리드 컴포넌트 — 일~토 7개 컬럼, 각 컬럼은 세로 24시간 축에 그날의 스케줄 블록을 절대 포지셔닝으로 배치(`DayTimeline`과 동일한 색상 규칙)
- [ ] 주 단위 이동 — 이전 주 / 다음 주 / "이번 주" 버튼, 헤더에 "YYYY-MM-DD ~ YYYY-MM-DD" 범위 표시
- [ ] 각 요일 컬럼 헤더(요일명 + 날짜)를 클릭하면 "일간" 뷰로 전환되고 그 날짜가 선택된다(App의 기존 `date`/`setDate` 상태 재사용)
- [ ] 오늘 날짜 컬럼 하이라이트(데일리노트 캘린더 뷰의 "오늘" 강조 스타일 참고)

### 2.2 Out of Scope

- 주간 뷰에서 스케줄 블록 직접 편집(제목 수정/상태 변경/시간 변경)·삭제 — 조회 전용, 편집은 요일 클릭 후 일간 뷰에서 수행
- 주간 뷰에서의 DnD(할일 배치) — 기존 일간 뷰의 DnD 영역과 완전히 분리
- 서버에 주간 범위 조회 API(`GET /api/schedules?startDate=&endDate=`) 신설 — 클라이언트에서 기존 날짜별 API를 병렬 호출하는 것으로 충분한 규모로 판단(§7.2 참고)
- 월간 뷰, 주 시작 요일 커스터마이즈(월요일 시작 등) 설정
- 오늘 일정의 실시간 자동 상태 전환 반영을 위한 폴링(주간 뷰는 진입 시 1회 조회, 일간 뷰의 60초 폴링과는 별개 — §3.2 NFR 참고)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 일정관리 탭 상단에 "일간" / "주간" pill 버튼이 있고, 기본값은 "일간"이다 | High | Pending |
| FR-02 | "일간" 선택 시 기존 레이아웃(DateNavigator + TaskBacklog + TimeGrid + DayTimeline, DnD 포함)이 변경 없이 그대로 보인다 | High | Pending |
| FR-03 | "주간" 선택 시 오늘이 포함된 주(일요일 시작)를 기본으로 보여준다 | High | Pending |
| FR-04 | 주간 뷰는 일~토 7개 컬럼을 가지며, 각 컬럼 헤더에 요일명과 날짜(예: "월 09/08")를 표시하고 일요일/토요일은 빨간 계열로 구분한다 | High | Pending |
| FR-05 | 각 요일 컬럼은 세로 24시간 축 위에 그날의 스케줄을 시작/종료 시각에 비례한 높이의 블록으로 표시하며, 상태(예정/진행중/완료)에 따라 `DayTimeline`과 동일한 색상을 사용한다 | High | Pending |
| FR-06 | 헤더의 "◀"/"▶" 버튼으로 이전/다음 주로 이동할 수 있고, "이번 주" 버튼으로 오늘이 포함된 주로 즉시 돌아올 수 있다 | High | Pending |
| FR-07 | 오늘 날짜에 해당하는 컬럼은 시각적으로 강조(테두리 또는 배경색)된다 | Medium | Pending |
| FR-08 | 요일 컬럼의 헤더를 클릭하면 "일간" 뷰로 전환되고 해당 날짜가 선택된 상태로 보인다 | High | Pending |
| FR-09 | 주간 뷰 진입/주 이동 시 7일치 데이터를 병렬로 조회하며, 로딩 중에는 간단한 로딩 표시를 보여준다 | Medium | Pending |
| FR-10 | 주간 뷰에서는 블록 클릭/드래그로 수정·삭제·이동이 되지 않는다(조회 전용) | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 회귀 방지 | 기존 일간 뷰의 DnD, 상태 변경, 폴링(60초) 동작에 변경 없음 | 수동 테스트 (일간 뷰에서 기존 시나리오 재확인) |
| 일관성 | 색상 규칙(`STATUS_STYLE`)과 요일 색상 규칙(일/토 빨간색)을 기존 컴포넌트와 동일하게 재사용 | 코드 리뷰 |
| 규모 가정 | 로컬 단일 사용자, 하루 스케줄 수가 적은 개인 앱 — 7개 병렬 fetch로 충분하며 신규 서버 API·인덱스가 불필요한 규모로 간주 | 해당 없음 |
| 데이터 정합성 | 주간 뷰는 일간 뷰와 동일한 `GET /api/schedules?date=` 응답을 그대로 사용하므로 두 뷰의 데이터가 항상 일치한다(별도 캐시/변환 없음) | 코드 리뷰 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 일정관리 탭에서 "일간"/"주간" pill로 뷰를 전환할 수 있다
- [ ] "일간" 뷰는 기존과 동일하게 동작한다(회귀 없음)
- [ ] "주간" 뷰에서 일~토 7일의 스케줄이 상태별 색상으로 표시된다
- [ ] 이전 주/다음 주/이번 주 이동이 정상 동작한다
- [ ] 요일 헤더 클릭 시 해당 날짜의 일간 뷰로 이동한다
- [ ] 오늘 컬럼이 시각적으로 구분된다

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(여러 날짜에 스케줄 등록 → 주간 뷰 전환 → 좌우 주 이동 → 요일 클릭 → 일간 뷰 복귀) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 7일치 데이터를 매번 병렬 호출하면서 서버(Firestore) 응답 지연 시 주간 뷰 전체가 느려 보일 수 있음 | Low | Low | 개인 앱 규모(하루 스케줄 소수)를 가정. 필요 시 후속 개선으로 날짜 범위 API 도입 검토 |
| 좁은 컬럼(7분할) 안에 24시간 타임라인을 압축하면 텍스트가 잘리거나 겹칠 수 있음 | Medium | Medium | Design 단계에서 컬럼 폭 대비 최소 폰트/블록 높이 기준을 정하고, 필요 시 짧은 블록은 제목만(시간 생략) 표시 |
| 사용자가 주간 뷰에서도 편집을 기대할 수 있음(기대와 실제 스코프 불일치) | Low | Medium | "조회 전용"임을 안내 문구 또는 요일 클릭 유도 UI로 명확히 표시 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `client/src/App.jsx` | Component | `tab === 'schedule'` 블록 내부에 뷰 전환 상태(`scheduleView`) 추가, 기존 레이아웃을 'daily' 분기로 감싸고 'weekly' 분기 추가 |
| `client/src/components/WeekTimeline.jsx` | Component | 신규 — 주간 타임라인 그리드 + 주 이동 컨트롤 |
| `client/src/hooks/useWeekSchedules.js` | Hook | 신규 — 주의 7일 스케줄을 병렬 조회 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `useSchedules(date)` / `api/schedules.js`의 `fetchSchedules` | READ (병렬 재사용) | `App.jsx`의 일간 뷰, 신규 `useWeekSchedules` | None — 기존 훅/함수는 변경 없이 그대로 재사용, 신규 훅이 같은 API 함수를 여러 날짜에 대해 호출할 뿐 |
| `App.jsx`의 `date`/`setDate`, 탭 전환(`goToTab`) | READ/WRITE | 요일 클릭 → 일간 뷰 딥링크 | None — 기존 상태를 그대로 재사용(예: 캘린더 탭의 고객사 티켓 딥링크 패턴과 동일한 방식) |
| 기존 다른 메뉴 | 없음 | 없음 | None — 신규 기능은 일정관리 탭 내부에 완전히 격리됨 |

### 6.3 Verification

- [ ] `App.jsx`의 변경이 `tab === 'schedule'` 블록 내부(뷰 전환 상태 + 분기)로 최소화되었는지 확인
- [ ] 신규 훅이 기존 `api/schedules.js`의 함수를 신규 수정 없이 그대로 재사용했는지 확인
- [ ] 다른 탭(포커스맵/고객사티켓/캘린더 등)의 코드에 변경이 없는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 React(Vite) + Express + Firebase Firestore(2026-09 SQLite에서 마이그레이션 완료, `docs/guides/firebase-firestore-integration.md` 참고) 커스텀 스택이다. 아래 표는 실제 스택 기준으로 작성한다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 상태 관리 | 로컬 React state + custom hook | 기존 `useSchedules` 패턴 재사용 |
| API 클라이언트 | 순수 `fetch` 래퍼 (`api/schedules.js`) | 신규 함수 추가 없이 기존 `fetchSchedules` 재사용 |
| 백엔드 | Express + Firestore | 변경 없음 — 이 기능은 서버 코드를 전혀 건드리지 않는다 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 주간 데이터 조회 방식 | (A) 서버에 `GET /api/schedules?startDate=&endDate=` 범위 조회 API 신설 / (B) 클라이언트에서 기존 `fetchSchedules(date)`를 7일치 병렬 호출 | **(B)** | Simplicity First. 개인 앱 규모(하루 스케줄 소수)에서는 7개 병렬 fetch로 충분하고, 서버 라우트·Firestore 쿼리·복합 인덱스 추가가 불필요해진다. 향후 실사용에서 느려지면 (A)로 전환 검토 |
| 뷰 전환 UI 위치/패턴 | (A) 최상위 `TABS`에 "주간일정" 탭을 별도 추가 / (B) 기존 "일정관리" 탭 내부에 데일리노트식 뷰 전환 pill 추가 | **(B)** | 사용자가 명시적으로 "일정관리 내에 별도의 탭"을 요청. 데일리노트(`DailyNote.jsx`)가 이미 같은 패턴(목록/캘린더/마인드맵 내부 전환)으로 검증되어 있어 그대로 재사용 |
| 주간 그리드 구현 방식 | (A) 신규 캘린더/스케줄러 라이브러리 도입 / (B) `DayTimeline`과 동일한 절대 포지셔닝 방식을 7개 컬럼으로 확장한 자체 구현 | **(B)** | 프로젝트가 차트/캘린더 라이브러리를 쓰지 않는 기존 관례를 따름. `DayTimeline`의 `HOUR_HEIGHT` 기반 로직을 그대로 재사용 가능해 신규 의존성 없이 구현 가능 |
| 요일 클릭 시 이동 방식 | (A) 주간 뷰 안에 인라인으로 일간 상세를 펼침 / (B) 뷰 전환 상태를 'daily'로 바꾸고 App의 `date`를 갱신해 기존 일간 뷰로 이동 | **(B)** | 이미 검증된 일간 뷰를 그대로 재사용해 별도의 상세 UI를 새로 만들 필요가 없고, 캘린더 탭 → 고객사 티켓 딥링크와 동일한 기존 패턴을 재사용 |

### 7.3 폴더 구조 변화 (예상)

```
client/src/
├── App.jsx                        # tab==='schedule' 내부에 scheduleView 상태 + 분기 추가
├── hooks/
│   └── useWeekSchedules.js        # 신규 — 주 7일 스케줄 병렬 조회
└── components/
    └── WeekTimeline.jsx           # 신규 — 주간 타임라인 그리드 + 주 이동 컨트롤
```

기존 `DateNavigator.jsx`, `DayTimeline.jsx`, `TimeGrid/`, `TaskBacklog/`는 변경 없음.

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [x] 뷰 전환 pill 버튼 컨벤션 존재 (`DailyNote.jsx`의 `VIEWS` 패턴) — 동일하게 재사용
- [x] 스케줄 상태별 색상 컨벤션 존재 (`DayTimeline.jsx`의 `STATUS_STYLE`) — 동일하게 재사용

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 컬럼 폭이 좁을 때의 블록 표시 규칙 | 없음(일간 뷰는 단일 넓은 컬럼 가정) | 7분할 컬럼에서 제목/시간 표시 축약 규칙 | High |
| 주 시작 요일 | 데일리노트 캘린더가 일요일 시작(`WEEKDAYS`) | 주간 뷰도 동일하게 일요일 시작으로 통일 | Medium |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`schedule-weekly-view.design.md`) — 컬럼 레이아웃 상세 치수, 블록 축약 표시 규칙, `useWeekSchedules` 인터페이스 확정
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do schedule-weekly-view`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-04 | Initial draft | Mincoln Cho |
