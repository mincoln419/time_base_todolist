---
template: plan
version: 1.3
---

# daily-idea-note Planning Document

> **Summary**: 신규 메뉴 "데일리노트" — 그날 떠오른 아이디어를 키워드/카테고리/연관 키워드/항목으로 구조화해 기록하고, 내용은 최대 2000자의 마크다운(AI 정리 내용 포함 가능)으로 자유 형식 작성하며, 캘린더 뷰와 마인드맵 뷰로 탐색하는 기능
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-30
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 하루 중 떠오른 아이디어를 남길 전용 공간이 없어 메모가 흩어지고, 나중에 "그 아이디어가 어떤 주제/키워드와 연결됐었는지" 되짚어보기 어렵다 |
| **Solution** | 새 메뉴 "데일리노트"를 추가해 키워드·카테고리·연관 키워드·항목을 구조화된 필드로 입력받고, 본문은 마크다운(최대 2000자)으로 자유롭게 기록하게 한다. 기록된 노트는 날짜 기준 캘린더 뷰와 키워드/카테고리 연결 기준 마인드맵 뷰 두 가지로 열람할 수 있다 |
| **Function/UX Effect** | 아이디어를 "언제 떠올렸는가(캘린더)"와 "무엇과 연결되는가(마인드맵)" 두 축으로 다시 찾아볼 수 있어, 단순 나열형 메모보다 회고·재사용이 쉬워진다 |
| **Core Value** | 순간적인 아이디어를 구조화된 형태로 축적해, 시간이 지나도 맥락(키워드/카테고리 관계)을 잃지 않고 다시 꺼내 쓸 수 있는 개인 지식 기록 도구로 만든다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 아이디어 메모가 구조 없이 흩어져 있어 나중에 주제별/시점별로 다시 찾기 어려움 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 하루 동안 떠오른 아이디어를 그때그때 짧게 기록하고 나중에 되짚어보는 사람 |
| **RISK** | 카테고리/연관 키워드를 자유 텍스트로 둘 경우 오탈자로 인한 분산(마인드맵 연결 끊김), 마인드맵 레이아웃 알고리즘의 구현 난이도 |
| **SUCCESS** | 노트를 키워드/카테고리/연관 키워드/항목 + 마크다운 본문(최대 2000자)으로 저장할 수 있고, 캘린더 뷰에서 날짜별로, 마인드맵 뷰에서 키워드 연결로 각각 열람 가능 |
| **SCOPE** | (1) daily_notes 스키마 신설 (2) 서버 API 신설 (3) 데일리노트 입력 폼 UI (4) 캘린더 뷰 (5) 마인드맵 뷰 (6) 신규 메뉴 탭 등록 |

---

## 1. Overview

### 1.1 Purpose

새 메뉴 "데일리노트"를 추가해, 하루 동안 떠오른 아이디어를 구조화된 메타데이터(키워드/카테고리/연관 키워드/항목)와 자유 형식 마크다운 본문으로 기록하고, 캘린더·마인드맵 두 가지 시각으로 탐색할 수 있게 한다.

### 1.2 Background

현재 프로젝트에는 일정관리, 포커스 맵, 고객사 티켓, 무의식 고민목록, 장기목표, 업무 배치 보드 메뉴가 있지만, "하루 동안 떠오른 아이디어"를 즉흥적으로 기록해두는 전용 공간은 없다. 사용자 요청에 따라 다음 사항을 확정한다:

- 입력 필드는 **키워드 / 카테고리 / 연관 키워드 / 항목**을 구조화된 필드로 받는다(모두 자유 텍스트 입력).
- 본문(내용)은 **형식 자유** — 마크다운 문법을 지원하며, AI가 정리해 준 내용을 그대로 붙여넣어도 되는 순수 텍스트 입력란이다(별도 AI 자동 생성/호출 기능은 이번 범위에 포함하지 않음 — Out of Scope 참조).
- 본문 입력 한도는 **최대 2000자**로 제한한다(기존 무의식 고민목록의 메모 필드와 동일한 한도로, 프로젝트 내 기존 관례를 따름).
- 기록된 노트는 **캘린더 뷰**(날짜 기준)와 **마인드맵 뷰**(키워드/카테고리/연관 키워드 기준 연결) 두 가지 형태로 표현한다.

### 1.3 Related Documents

- 마크다운 렌더링 선례: `client/src/components/UnconsciousWorries/UnconsciousWorries.jsx` (marked + DOMPurify, `MAX_CONCLUSION_LENGTH = 2000` 패턴)
- 캘린더 UI 선례(도메인은 다르지만 레이아웃 참고): `client/src/components/Calendar/Calendar.jsx` (고객사 티켓 전용, 재사용하지 않고 신규 컴포넌트로 분리 — §7.2 참고)
- 신규 메뉴 탭 등록 패턴: `client/src/App.jsx`의 `TABS` 배열 및 `goToTab` 히스토리 처리

---

## 2. Scope

### 2.1 In Scope

- [x] `daily_notes` 테이블 신설 (date, keyword(해시태그 다중), category, item, content, created_at, updated_at)
- [ ] `GET/POST/PUT/DELETE /api/daily-notes` API 신설
- [ ] "데일리노트" 신규 메뉴 탭 등록 (`App.jsx` TABS)
- [x] 입력 폼: 키워드(해시태그 다중 입력) · 카테고리 · 항목(텍스트 입력) + 본문(마크다운 텍스트에어리어, 최대 2000자, 글자 수 카운터)
- [ ] 본문 마크다운 미리보기(작성/미리보기 토글 또는 분할 뷰) — 기존 memo 렌더링 방식 재사용
- [ ] 노트 목록(기본 뷰) — 최신순, 키워드/카테고리로 필터링
- [ ] 캘린더 뷰 — 월 단위 그리드에서 노트가 있는 날짜 표시, 클릭 시 해당 날짜 노트 목록 열람
- [x] 마인드맵 뷰 — 노트를 노드로, 같은 카테고리 또는 겹치는 키워드(태그)로 연결된 노트끼리 선으로 연결해 시각화, 노드 클릭 시 상세 열람
- [ ] 노트 수정/삭제

### 2.2 Out of Scope

- AI를 호출해 본문을 자동 요약/정리해주는 기능 (본문에 "AI가 정리한 내용"을 사용자가 직접 붙여넣는 것만 지원 — 자동 생성 API 연동 없음)
- 카테고리/연관 키워드의 사전 정의된 값 목록·자동완성·태그 마스터 관리
- 마인드맵에서 노드를 드래그로 재배치하고 그 위치를 저장하는 기능 (레이아웃은 매번 자동 계산)
- 다른 메뉴(할일, 장기목표 등)와의 데이터 연동/변환 (예: 노트를 할일로 전환)
- 노트 검색(전문 검색), 첨부파일/이미지 삽입
- 여러 날짜에 걸친 노트 이동(날짜 재지정) 이력 관리

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `daily_notes` 테이블은 `id`(PK), `date`, `keyword`(해시태그 스타일 다중 값, 쉼표 구분 저장), `category`, `item`, `content`, `created_at`, `updated_at`을 저장한다 | High | Done |
| FR-02 | `GET /api/daily-notes`는 전체 노트 목록을 반환하며, `date`(YYYY-MM-DD) 또는 `month`(YYYY-MM) 쿼리 파라미터로 필터링할 수 있다 | High | Pending |
| FR-03 | `POST /api/daily-notes`는 새 노트를 생성한다 — `keyword` 필수, `date`는 미지정 시 오늘 날짜로 기본 설정 | High | Pending |
| FR-04 | `PUT /api/daily-notes/:id`는 해당 노트의 필드(키워드/카테고리/항목/본문/날짜)를 갱신한다 | High | Done |
| FR-05 | `DELETE /api/daily-notes/:id`는 해당 노트를 삭제한다 | Medium | Pending |
| FR-06 | 본문(`content`)은 서버에서 2000자를 초과하면 400을 반환하고, 클라이언트 입력란도 `maxLength=2000`으로 제한하며 현재 글자 수를 표시한다 | High | Pending |
| FR-07 | 본문은 마크다운 문법으로 작성하며, 목록/열람 화면에서는 기존 memo 렌더링 방식(marked+DOMPurify)으로 HTML 변환해 보여준다 | High | Pending |
| FR-08 | 입력 폼에는 키워드(해시태그 칩 입력, 1개 이상 필수) · 카테고리 · 항목 · 본문(마크다운) 필드가 존재하며, 키워드를 제외한 나머지는 선택 입력이다. 키워드는 Enter/쉼표로 태그를 여러 개 추가·×로 삭제할 수 있다 (2026-09-01 amendment — 기존 "키워드"(단일)+"연관 키워드"(다중) 2필드를 "키워드"(다중, 해시태그) 1필드로 통합) | High | Done |
| FR-09 | "데일리노트" 메뉴는 기본적으로 노트 목록(리스트) 뷰를 보여주고, 상단 탭/버튼으로 "캘린더 뷰"·"마인드맵 뷰"로 전환할 수 있다 | High | Pending |
| FR-10 | 캘린더 뷰는 월 단위 그리드를 보여주고, 노트가 1개 이상 있는 날짜에 개수를 표시하며, 날짜 클릭 시 해당 날짜의 노트 목록을 열람할 수 있다 | High | Pending |
| FR-11 | 마인드맵 뷰는 각 노트를 노드로 그리고, 같은 `category` 값을 가지거나 `keyword` 태그 집합이 하나라도 겹치는 노트끼리 선으로 연결한다 — 한 노트가 여러 태그를 가지고 한 태그가 여러 노트에 걸릴 수 있어 노트 간 관계는 자연스럽게 n:n이 된다 | High | Done |
| FR-16 | 마인드맵 뷰는 모든 노트를 하나의 캔버스에 `d3-force` 물리 시뮬레이션으로 배치하고, 노드를 드래그로 직접 옮길 수 있다. 연결된 두 노드는 40~250px 범위 안에서는 드래그하는 노드만 움직이고 연결된 상대 노드는 절대 움직이지 않으며, 250px를 넘어 늘어나면 상대 노드가 정확히 200px 거리로 끌려오고 40px 아래로 압축되면 정확히 40px로 밀려난다 (2026-09-01 추가 — 처음엔 jQuery/Raphael 기반 js-mindmap의 힘-기반 레이아웃 개념을 jQuery 없이 손수 구현했으나, 정확한 경계값 수렴 문제로 사용자가 제시한 D3 forceSimulation 예제를 참고해 검증된 `d3-force` 패키지로 교체) | High | Done |
| FR-12 | 마인드맵 뷰에서 노드를 클릭하면 해당 노트의 상세 내용(항목/키워드/본문 렌더링)을 볼 수 있다 | Medium | Pending |
| FR-13 | 목록/캘린더/마인드맵 어느 뷰에서든 노트를 수정·삭제할 수 있다 | Medium | Pending |
| FR-14 | 입력 폼에 "태그추출(AI)" 버튼이 있어, 클릭 시 서버가 Anthropic API(Claude)로 현재 입력된 본문을 분석해 카테고리 1개와 키워드(태그) 목록을 추출하고, 그 결과를 폼의 카테고리·키워드 입력란에만 채운다(자동 저장 없음). API 키는 리포 루트 `.env`의 `CLAUDE_KEY`(또는 `CLAUD_KEY`)에서 서버가 읽으며 클라이언트로 전달되지 않는다. 신규 작성·기존 노트 수정 양쪽 모두에서 동작한다 (2026-09-01 추가) | High | Done |
| FR-15 | 입력 폼의 "저장" 버튼 옆에 "되돌리기" 버튼이 있어, 클릭 시 폼의 모든 필드(AI 추출로 바뀐 값 포함)를 원래 값 — 기존 노트 수정 중이면 DB에 저장된 값, 신규 작성 중이면 빈 초안 — 으로 되돌린다. 저장을 누르기 전까지는 어떤 변경도 DB에 반영되지 않는다 (2026-09-01 추가) | High | Done |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 입력 검증 | 본문 2000자 제한은 클라이언트/서버 양쪽에서 일관되게 적용 | 수동 테스트 (2000자 초과 입력 시도) |
| 일관성 | 마크다운 렌더링은 신규 라이브러리 도입 없이 기존 `marked`+`dompurify` 조합을 그대로 재사용 | 코드 리뷰 |
| 회귀 방지 | 기존 메뉴(일정관리, 포커스 맵 등)의 탭 전환·히스토리 동작에 영향 없음 | 수동 테스트 |
| 규모 가정 | 로컬 단일 사용자 SQLite 환경 — 노트 수 수백 개 수준을 가정, 마인드맵은 전체 노트를 한 번에 로드해도 무리 없는 규모로 간주 (페이지네이션 불필요) | 해당 없음 |
| 보안 (2026-09-01 추가) | Anthropic API 키는 서버 프로세스에서만 읽고 응답 바디를 포함해 어떤 형태로도 클라이언트에 노출하지 않는다. `.env`는 `.gitignore`에 이미 포함되어 커밋되지 않는다 | 코드 리뷰 — 클라이언트 번들/네트워크 응답에 키 문자열 없음 확인 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [x] 데일리노트 메뉴에서 키워드(다중 태그)/카테고리/항목/본문을 입력해 노트를 생성할 수 있다
- [ ] 본문에 마크다운을 작성하면 목록/상세에서 렌더링되어 보인다
- [ ] 본문에 2000자를 초과해 입력할 수 없다 (입력란 제한 + 서버 검증)
- [ ] 캘린더 뷰에서 노트가 있는 날짜를 확인하고, 클릭해 해당 날짜 노트를 열람할 수 있다
- [x] 마인드맵 뷰에서 카테고리 또는 겹치는 키워드(태그)로 연결된 노트들이 시각적으로 연결되어 보인다 (n:n — 한 노트가 여러 노트와 동시에 연결 가능)
- [ ] 노트를 수정/삭제할 수 있다
- [ ] 기존 메뉴 탭 동작(전환, 브라우저 뒤로가기)에 회귀 없음

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(노트 3건 이상 작성 → 목록 확인 → 캘린더에서 날짜별 확인 → 마인드맵에서 연결 확인 → 수정/삭제) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 카테고리/연관 키워드를 자유 텍스트로 받아 오탈자·표기 차이(예: "아이디어" vs "아이디어 ")로 마인드맵 연결이 끊김 | Medium | Medium | Design 단계에서 저장/비교 시 trim + 공백 정규화 규칙을 정의. 사전 정의된 값 목록 도입은 Out of Scope로 유지하고 후속 개선 과제로 남김 |
| 마인드맵 자동 레이아웃(노드 겹침, 연결선 교차) 구현 난이도로 가독성이 떨어질 수 있음 | Medium | Medium | 신규 npm 의존성(D3 등) 도입 없이 단순 원형/그리드 배치로 MVP를 구현하고, 노트 수가 적을 때 우선 검증. 라이브러리 도입 여부는 Design에서 별도 판단 |
| 본문 2000자 제한이 "AI가 정리한 내용"을 붙여넣기엔 부족할 수 있음 | Low | Medium | 기존 무의식 고민목록 메모와 동일한 한도로 프로젝트 관례를 따름. 필요 시 후속 요청으로 한도 조정 |
| 노트가 많아질수록 마인드맵 전체 로드 방식이 느려질 수 있음 | Low | Low | 현재 규모(로컬 단일 사용자, 수백 건 이하)를 가정해 페이지네이션 없이 구현하고, 실사용에서 문제가 확인되면 후속 개선 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `daily_notes` 테이블 | DB Schema | 신규 테이블 생성 |
| `/api/daily-notes` | API | 신규 라우트 (`GET /`, `POST /`, `PUT /:id`, `DELETE /:id`) |
| `client/src/App.jsx` | Component | `TABS` 배열에 `dailynote` 탭 추가, 탭 렌더링 분기 추가 |
| `client/src/components/DailyNote/*` | Component | 신규 컴포넌트 디렉터리 (폼, 목록, 캘린더 뷰, 마인드맵 뷰) |
| `client/src/hooks/useDailyNotes.js`, `client/src/api/dailyNotes.js` | Hook/API | 신규 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `App.jsx` TABS/탭 전환 로직 | READ/WRITE (탭 상태) | `App.jsx`의 `goToTab`, `useEffect(popstate)` | None — 기존 탭 배열에 항목만 추가, 전환 로직 자체는 변경 없음 |
| `marked`/`dompurify` | READ (라이브러리) | `UnconsciousWorries.jsx`의 렌더링 패턴 재사용 | None — 신규 컴포넌트에서 동일 라이브러리를 새로 import해 사용, 기존 코드 변경 없음 |
| 기존 다른 메뉴(일정관리/포커스맵 등) | 없음 | 없음 | None — 신규 기능은 독립 테이블/라우트/컴포넌트로 완전히 분리됨 |

### 6.3 Verification

- [ ] `daily_notes` 관련 코드(schema, route, hook, api, component)가 다른 메뉴 코드를 수정하지 않고 독립적으로 추가되었는지 확인
- [ ] `App.jsx`의 변경이 `TABS` 배열 추가 + 탭 분기 추가로 최소화되었는지 확인
- [ ] 마크다운 렌더링에 신규 의존성을 추가하지 않고 기존 `marked`/`dompurify`를 재사용했는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 bkit의 Starter/Dynamic/Enterprise(Next.js/bkend.ai 프리셋) 분류 대상이 아닌, React(Vite) + Express + SQLite 커스텀 스택이다. 아래 표는 실제 스택 기준으로 작성한다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 마크다운 렌더링 | `marked` + `dompurify` (이미 설치됨) | 신규 의존성 추가 없이 기존 패키지 재사용 |
| 상태 관리 | 로컬 React state + custom hook | 기존 `useTasks`/`useFocusMap` 패턴 재사용 |
| API 클라이언트 | 순수 `fetch` 래퍼 (`api/*.js`) | 기존 컨벤션 재사용 |
| 백엔드 | Express + SQLite 동기 호출 | 기존과 동일 |
| DB | SQLite 파일 (`data/todo.db`) | 기존과 동일, 테이블만 추가 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 캘린더 뷰 구현 방식 | (A) 기존 `Calendar.jsx`(고객사 티켓 전용) 확장/재사용 / (B) 데일리노트 전용 신규 캘린더 컴포넌트 작성 | **(B)** | 기존 `Calendar.jsx`는 고객사 티켓 도메인 데이터·딥링크에 결합되어 있어, 재사용 시 오히려 두 도메인이 얽힘. 프로젝트가 "컴포넌트/훅/라우트 1:1 대응" 관례를 따르므로 신규 도메인은 신규 컴포넌트로 분리 |
| 마인드맵 구현 방식 | (A) D3(d3-force 등) 신규 의존성 도입 / (B) 신규 의존성 없이 SVG 기반 단순 원형/그리드 배치로 자체 구현 | **(B)** | Simplicity First 원칙과 현재 프로젝트가 차트 라이브러리를 전혀 쓰지 않는 관례를 따름. 최초 MVP는 노트 수가 적은 것을 가정해 단순 배치로 충분히 검증 가능 |
| 다중 키워드 저장 형태 | (A) 별도 정규화 테이블(`daily_note_keywords`, n:n 조인) / (B) `keyword` 컬럼에 쉼표 구분 문자열로 저장 | **(B)** | 사전 정의된 키워드 마스터 관리는 Out of Scope. 자유 텍스트 다중 값을 단순 문자열로 저장하는 것으로 충분하며, 마인드맵 연결 계산 시 클라이언트/서버에서 split+trim으로 처리. (2026-09-01 amendment: 기존 "키워드"+"연관 키워드" 2필드를 이 방식 그대로 "키워드" 1필드·해시태그 다중 값으로 통합 — 저장 형태 결정 자체는 변경 없음) |
| 본문 2000자 제한 적용 위치 | (A) 클라이언트만 / (B) 클라이언트 `maxLength` + 서버 검증 이중 적용 | **(B)** | API를 직접 호출하는 경우까지 대비해 서버에서도 검증 (기존 프로젝트에 별도 API 검증 미들웨어가 없으므로 라우트 핸들러 내 직접 체크) |

### 7.3 폴더 구조 변화 (예상)

```
server/
├── db/schema.sql              # daily_notes 테이블 정의 추가
├── routes/dailyNotes.js       # GET/, POST/, PUT/:id, DELETE/:id
client/src/
├── api/dailyNotes.js          # listDailyNotes, createDailyNote, updateDailyNote, deleteDailyNote
├── hooks/useDailyNotes.js     # 목록 조회/생성/수정/삭제
└── components/DailyNote/
    ├── DailyNote.jsx           # 컨테이너 — 입력 폼 + 뷰 전환(목록/캘린더/마인드맵)
    ├── DailyNoteForm.jsx       # 키워드(해시태그 다중)/카테고리/항목/본문(마크다운) 입력 폼
    ├── DailyNoteList.jsx       # 기본 목록 뷰 (마크다운 렌더링 + 필터)
    ├── DailyNoteCalendarView.jsx  # 월별 캘린더 뷰
    └── DailyNoteMindMapView.jsx   # 마인드맵 뷰 (SVG 기반)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [ ] 별도 `docs/01-plan/conventions.md` 없음 — 기존 코드 스타일(컴포넌트/훅/라우트 1:1 대응 패턴)을 컨벤션으로 간주하고 따른다
- [x] 마크다운 memo 필드의 글자 수 제한 관례 존재 (`MAX_CONCLUSION_LENGTH = 2000`, `UnconsciousWorries.jsx`) — 동일 값으로 통일

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| API 응답 형태 | 다른 메뉴는 목록=배열, 단건=객체 형태 | 데일리노트 API도 동일 형태로 통일 | High |
| 에러 메시지 | 한국어 메시지, `{ error: '...' }` 형태 (기존) | 신규 라우트도 동일 포맷 유지 (2000자 초과 시 400 + 한국어 메시지) | High |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`daily-idea-note.design.md`) — API 상세 스펙, 마인드맵 연결 계산 로직, 캘린더 뷰 상세 인터랙션 확정
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do daily-idea-note`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-30 | Initial draft | Mincoln Cho |
| 0.2 | 2026-09-01 | 키워드를 해시태그 스타일 다중 입력으로 변경, 별도였던 "연관 키워드" 필드를 "키워드"로 통합 — 노트 간 마인드맵 연결이 다중 키워드 교집합 기준 n:n 관계가 되도록 함 (FR-01/04/08/11 갱신) | Mincoln Cho |
| 0.3 | 2026-09-01 | "태그추출(AI)" 버튼 추가 — Anthropic API(Claude)로 본문에서 카테고리·키워드를 추출해 입력란에만 채움(자동 저장 없음). "되돌리기" 버튼 추가 — DB 저장값(또는 신규 작성 시 빈 초안)으로 폼을 되돌림. FR-14/15, 보안 NFR 추가 | Mincoln Cho |
| 0.4 | 2026-09-01 | 마인드맵 뷰를 결정론적 허브-스포크 레이아웃에서 손수 구현한 힘-기반 물리 시뮬레이션(드래그 가능)으로 교체 — jQuery 없이 React+SVG로 구현. FR-16 추가 | Mincoln Cho |
| 0.5 | 2026-09-01 | 손수 구현 물리 엔진을 `d3-force` 패키지로 교체 — 정확한 40px/200px 경계 수렴을 안정적으로 보장. 슬랙 범위를 40~250px(스트레치 한계)/200px(복귀 목표)로 확정. FR-16 갱신 | Mincoln Cho |
