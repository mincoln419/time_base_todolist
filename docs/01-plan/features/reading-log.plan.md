---
template: plan
version: 1.3
---

# reading-log Planning Document

> **Summary**: 신규 메뉴 "독서기록" — 여러 권의 책을 동시에 "하루 10페이지 이상" 규칙으로 읽으면서, 책마다 시작일·현재 페이지·총 페이지를 등록하면 남은 일수와 완독 예상일을 계산하고, 날마다 할일 목록처럼 체크해 갱신하며, GitHub 잔디 형태의 히트맵으로 독서 여부를 점검하는 기능
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-24
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 여러 권을 동시에 조금씩 읽다 보면 책마다 어디까지 읽었는지, 언제 끝날지, 오늘 읽었는지를 따로 챙기기 어렵고, 빼먹은 날이 쌓여도 알아차리지 못한다 |
| **Solution** | 책을 한 행(row)으로 등록하고(시작일 + 현재 페이지 + 총 페이지), 매일 할일 목록처럼 "오늘 읽음"을 체크하면서 도달 페이지를 기록한다. 하루 최소 10페이지를 기준으로 남은 일수·완독 예상일을 계산하고, 날짜별 독서 여부를 잔디 히트맵으로 보여준다 |
| **Function/UX Effect** | 오늘 읽어야 할 책 목록이 체크리스트로 바로 보이고, 10페이지보다 더 읽으면 예상일이 당겨지고 체크를 빼먹으면 밀리는 것이 즉시 반영된다. 잔디로 꾸준함을 한눈에 점검할 수 있다 |
| **Core Value** | "하루 10페이지"라는 작은 습관을 여러 권에 동시에 적용하면서도, 진행도·남은 책·꾸준함을 한 화면에서 관리하는 개인 독서 습관 도구 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 여러 권 병행 독서 시 책별 진행도·완독 예상일·매일 읽었는지 여부를 따로 추적하기 어려움 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 하루 10페이지 이상을 목표로 여러 권을 동시에 읽는 사람 |
| **RISK** | 빼먹은 날/더 읽은 날에 따른 예상일 계산 규칙이 직관과 다를 수 있음, 과거 날짜 소급 기록 시 페이지 순서가 꼬일 수 있음 |
| **SUCCESS** | 책 행을 추가하면 남은 일수·예상일이 표시되고, 날마다 체크 + 도달 페이지 입력으로 진행도가 갱신되며, 잔디 히트맵에서 날짜별 독서 여부를 확인할 수 있음 |
| **SCOPE** | (1) readingBooks/readingLogs 컬렉션 신설 (2) 서버 API 신설 (3) 책 등록 폼 + 책 목록(행) UI (4) 오늘의 독서 체크리스트 (5) 잔디 히트맵 (6) 읽을 예정/완독 목록 (7) 신규 메뉴 탭 + 백업 스코프 등록 |

---

## 1. Overview

### 1.1 Purpose

새 메뉴 "독서기록"을 추가해, 동시에 읽는 여러 권의 책을 "하루 최소 10페이지" 규칙으로 관리한다. 책마다 남은 페이지로 완독까지 걸릴 일수를 예측하고, 날마다 할일 체크하듯 독서 여부와 도달 페이지를 갱신하며, GitHub 잔디처럼 날짜별 독서 기록을 시각화해 꾸준함을 점검한다.

### 1.2 Background

사용자 요청으로 다음 사항을 확정한다:

- **하루 목표는 기본 10페이지(최소치)** — 더 읽을 수 있으며, 더 읽으면 남은 일수가 줄어든다.
- **책마다 하루 목표 페이지 설정** (2026-09-24 amendment) — 도서관 책처럼 기한이 있으면 반납일(선택 입력)을 넣고, 오늘부터 반납일까지 남은 기간으로 하루 목표를 계산할 수 있어야 한다. 대출 기간 같은 값은 상수로 두지 않고 입력받는다.
- **여러 권 동시 진행** — 하루에 여러 책을 각각 체크한다.
- **행(row) 추가 입력값**: 독서 시작일자 + 현재 읽은 페이지 + 총 페이지 수 (+ 책 제목).
- **예측**: 남은 페이지 ÷ 10을 올림한 값이 남은 일수. 체크하지 않은 날은 진행이 없으므로 남은 일수가 그대로 남아, 예상 완독일이 뒤로 밀린다.
- **기본 양식은 기존 to-do list** — 체크박스 기반 목록이며, 날마다 새로 갱신된다(오늘 날짜 기준으로 체크 상태가 초기화된 것처럼 보임).
- **잔디 심기** — 날짜별로 책을 읽었는지를 GitHub 기여 그래프처럼 표시해 점검한다.
- **남은 책 확인** — 아직 다 읽지 않은 책(읽는 중·읽을 예정)이 무엇인지 확인할 수 있어야 한다.

### 1.3 Related Documents

- 날짜별 기록(복합키 upsert) 선례: `server/routes/worries.js` (worries/{id}/attempts/{date})
- 체크박스 목록 UI 선례: `client/src/components/LongGoals/LongGoals.jsx` 세부 목표 목록
- 신규 메뉴 탭 등록 패턴: `client/src/App.jsx`의 `TABS` 배열
- 백업 스코프 등록 패턴: `server/routes/backup.js`
- 컬렉션 상수: `server/db/collections.js`

---

## 2. Scope

### 2.1 In Scope

- [ ] `readingBooks` 컬렉션 신설 (id, title, total_pages, start_page(등록 시 현재 페이지), start_date, daily_target(기본 10), finished_at, created_at, updated_at)
- [ ] `readingLogs` 컬렉션 신설 — top-level, `book_id` 필드 + 문서 ID `{book_id}_{date}` (책×날짜당 1건, upsert)
- [ ] `GET/POST/PATCH/DELETE /api/reading/books`, `PUT/DELETE /api/reading/books/:id/logs/:date` API 신설
- [ ] "독서기록" 신규 메뉴 탭 등록 (`App.jsx` TABS)
- [ ] 책 등록 폼: 제목 · 시작일 · 현재 페이지 · 총 페이지 → 행 추가
- [ ] 책 목록(행): 진행 바(현재/총 페이지, %), 남은 페이지, 남은 일수, 완독 예상일, 수정/삭제
- [ ] 오늘의 독서 체크리스트: 읽는 중인 책마다 체크박스 + 도달 페이지 입력(기본값 = 현재 페이지 + 10), 체크 해제 시 해당 날짜 기록 삭제
- [ ] 날짜 선택(기본 오늘)으로 지난 날짜 체크를 소급 기록/수정
- [ ] 잔디 히트맵: 최근 1년(53주 × 7일) 그리드, 칸 색 농도 = 그날 읽은 페이지 합(또는 권수), 칸 hover 시 날짜·책·페이지 표시, 칸 클릭 시 해당 날짜로 체크리스트 이동
- [ ] 책별 상태 분류: 읽을 예정(시작일 > 오늘) / 읽는 중 / 완독(현재 페이지 ≥ 총 페이지 시 자동 완독 처리) — "남은 책" 섹션에서 예정·진행 중 목록 확인
- [ ] 백업 스코프에 독서기록 추가 (`backup.js`)

### 2.2 Out of Scope

- 책 검색 API(ISBN/도서 DB) 연동, 표지 이미지
- 독서 메모·감상문·밑줄 기록
- 연속 독서일(streak) 알림·웹훅 알림 연동
- 일정관리(시간 블록)와의 연동 — 독서를 시간 블록에 자동 배치하지 않음
- 여러 해 단위 히트맵 탐색(연도 전환) — 최근 1년만 표시

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `readingBooks` 문서는 `id`, `title`, `total_pages`, `start_page`, `start_date`, `daily_target`(기본 10), `finished_at`, `created_at`, `updated_at`을 저장한다 | High | Pending |
| FR-02 | `readingLogs` 문서는 `book_id`, `date`(YYYY-MM-DD), `page_to`(그날 도달한 페이지), `created_at`을 저장하고, 문서 ID는 `{book_id}_{date}`로 책×날짜당 1건만 존재한다 | High | Pending |
| FR-03 | `POST /api/reading/books`는 제목·총 페이지(1 이상 정수)·현재 페이지(0 ≤ 현재 ≤ 총)·시작일(미지정 시 오늘)을 검증해 책을 생성한다 | High | Pending |
| FR-04 | `GET /api/reading/books`는 모든 책과 각 책의 기록(logs)을 함께 반환한다(데이터 양이 적어 전체 로드, 기존 worries 방식과 동일) | High | Pending |
| FR-05 | `PATCH /api/reading/books/:id`는 제목·총 페이지·시작일·현재 페이지를 수정하고, `DELETE`는 책과 그 기록을 함께 삭제한다 | Medium | Pending |
| FR-06 | `PUT /api/reading/books/:id/logs/:date`는 해당 날짜의 도달 페이지를 upsert하고, `DELETE`는 그 날짜 기록(체크)을 삭제한다. 도달 페이지는 총 페이지를 넘을 수 없다 | High | Pending |
| FR-07 | 현재 페이지 = max(`start_page`, 모든 기록의 `page_to`). 현재 페이지가 총 페이지에 도달하면 `finished_at`을 기록해 완독 처리하고, 기록 삭제로 미달이 되면 완독을 해제한다 | High | Pending |
| FR-08 | 남은 일수 = ceil((총 페이지 − 현재 페이지) ÷ `daily_target`). 완독 예상일 = (오늘 체크했으면 내일, 아니면 오늘) + 남은 일수 − 1. 체크를 빼먹은 날이 지나면 예상일이 자동으로 뒤로 밀린다 | High | Pending |
| FR-09 | 그날 읽은 페이지 = 해당 날짜 `page_to` − 직전 기록(또는 `start_page`)의 도달 페이지. 10페이지 미만이면 체크는 되지만 잔디/목록에 "목표 미달"로 구분 표시한다 | Medium | Pending |
| FR-10 | 오늘의 독서 체크리스트는 선택한 날짜(기본 오늘) 기준 "읽는 중" 책을 할일 목록처럼 보여주고, 체크 시 도달 페이지(기본값 현재 + 10)를 입력받아 저장, 해제 시 해당 날짜 기록을 삭제한다. 날짜가 바뀌면 새 날짜 기준으로 미체크 상태로 보인다 | High | Pending |
| FR-11 | 책 등록 폼은 제목·시작일·현재 페이지·총 페이지를 입력받아 행을 추가하고, 입력 즉시 "약 N일 소요 / 예상 완독일"을 미리 보여준다 | High | Pending |
| FR-12 | 책 목록의 각 행은 진행 바(%), 현재/총 페이지, 남은 일수, 완독 예상일, 상태(예정/읽는 중/완독)를 표시한다 | High | Pending |
| FR-13 | 잔디 히트맵은 최근 1년을 주(열) × 요일(행) 그리드로 그리고, 그날 읽은 총 페이지 수에 따라 4~5단계 색 농도로 표시한다. hover 시 날짜와 책별 페이지를, 클릭 시 해당 날짜의 체크리스트로 이동한다 | High | Pending |
| FR-14 | "남은 책" 영역에 읽을 예정(시작일이 미래)·읽는 중 책을 남은 일수 순으로 보여주고, 완독 목록은 접을 수 있는 별도 영역에 완독일 순으로 보여준다 | Medium | Pending |
| FR-15 | 백업/복원 스코프에 "독서기록"(readingBooks, readingLogs)을 추가한다 | Medium | Pending |
| FR-16 | 책 등록/수정 폼에서 하루 목표 페이지(1 이상 정수, 기본 10)를 입력할 수 있고, 반납일(`due_date`, 선택)을 입력하면 "반납일 맞추기" 버튼이 오늘(오늘 이미 읽었으면 내일, 예정 책은 시작일)부터 반납일까지 남은 날로 남은 페이지를 나눠 하루 목표를 채운다. 목록 행에는 반납일·D-day와, 예상 완독일이 반납일을 넘으면 "반납일 초과 예상"을 표시한다. 기존 책은 10페이지 전제였으므로 `daily_target = 10` (2026-09-24 추가) | High | Done |
| FR-17 | 체크리스트의 체크 버튼 옆 "완독" 버튼은 확인 모달(예/아니오)을 거쳐 선택 날짜의 기록을 총 페이지(마지막 페이지)로 저장해 체크 + 완독 처리한다. 이미 체크한 행도 마지막 페이지 미만이면 버튼을 보여준다 (2026-09-24 추가) | High | Done |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 입력 검증 | 페이지 값(정수, 0 ≤ 현재 ≤ 총) 검증은 클라이언트/서버 양쪽에서 동일하게 적용 | 수동 테스트 (음수·초과값 입력) |
| 일관성 | 신규 라이브러리 도입 없이 Tailwind + 기존 fetch 래퍼/훅 패턴으로 구현 (히트맵은 div/SVG 그리드 직접 구현) | 코드 리뷰 |
| 날짜 처리 | 모든 날짜는 로컬 기준 YYYY-MM-DD 문자열로 다루어 타임존에 의한 하루 밀림이 없음 | 자정 전후 수동 테스트 |
| 회귀 방지 | 기존 메뉴의 탭 전환·히스토리·백업 동작에 영향 없음 | 수동 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 책 행을 추가하면 남은 일수와 완독 예상일이 표시된다
- [ ] 오늘 체크 + 도달 페이지 입력으로 진행도·예상일이 즉시 갱신된다 (10p 초과 시 예상일 당겨짐)
- [ ] 하루를 빼먹으면 다음 날 예상일이 하루 밀린다
- [ ] 잔디 히트맵에 체크한 날짜가 색으로 표시되고, 클릭으로 해당 날짜 기록을 수정할 수 있다
- [ ] 읽을 예정/읽는 중/완독 목록이 구분되어 보인다
- [ ] 백업/복원에 독서기록이 포함된다

### 4.2 Quality Criteria

- [ ] 클라이언트 빌드 성공 (`npm run build`)
- [ ] 기존 메뉴 회귀 없음

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 과거 날짜 소급 기록 시 `page_to`가 이후 날짜보다 커지는 역전 발생 | Medium | Medium | 서버에서 이전 기록 ≤ 신규 ≤ 이후 기록 범위를 검증하거나, 현재 페이지를 max로 계산해 역전이 진행도를 망가뜨리지 않게 함 (Design에서 확정) |
| 예상일 계산 기준(오늘 체크 여부)이 직관과 달라 보임 | Low | Medium | 행에 "하루 10p 기준 N일 남음" 문구를 함께 표기해 계산 근거를 드러냄 |
| 타임존 차이로 기록 날짜가 하루 밀림 | Medium | Low | 서버는 클라이언트가 보낸 YYYY-MM-DD 문자열만 저장, `toISOString()` 사용 금지 |
| 1년치 히트맵 렌더링 부담 | Low | Low | 371칸 고정 그리드, 날짜별 합계를 한 번에 Map으로 집계 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules, custom server | Web apps with backend | ☑ |
| **Enterprise** | Strict layer separation | High-traffic systems | ☐ |

기존 프로젝트 구조(React + Express + Firestore)를 그대로 따른다.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 기록 저장 구조 | 서브컬렉션 / top-level + book_id | top-level `readingLogs` + 문서ID `{book_id}_{date}` | 기존 자식 리소스 관례(top-level + FK 필드)와 일치, 문서 ID로 upsert가 단순, 백업 로직에 특수 처리 불필요 |
| 현재 페이지 | 책 문서에 저장 / 기록에서 계산 | 기록에서 계산(max) + `finished_at`만 저장 | 기록 삭제·소급 수정 시 값 불일치 방지 |
| 예측·잔디 계산 위치 | 서버 / 클라이언트 | 클라이언트 | 데이터 양이 적고, "오늘" 기준 계산이 화면 날짜와 일치해야 함 |
| 히트맵 | 라이브러리 / 직접 구현 | 직접 구현(Tailwind div 그리드) | 신규 의존성 없이 충분히 단순 |
| API Client / State | 기존 패턴 | `api/reading.js` + `hooks/useReading.js` | 기존 `longgoals.js` / `useLongGoals` 패턴과 동일 |

### 6.3 Folder Structure Preview

```
server/
├── routes/reading.js           # 신규
└── db/collections.js           # READING_BOOKS, READING_LOGS 추가
client/src/
├── api/reading.js              # 신규 fetch 래퍼
├── hooks/useReading.js         # 신규
└── components/ReadingLog/
    ├── ReadingLog.jsx          # 메뉴 루트 (등록 폼 + 목록 + 체크리스트)
    └── ReadingHeatmap.jsx      # 잔디 히트맵
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` 행동 가이드 및 아키텍처 섹션 존재
- [x] 라우트는 `asyncHandler` + `nextId` + `nowString` 헬퍼 사용 (`server/db/util.js`)
- [x] 컬렉션 이름은 `collections.js` 상수로만 참조

### 7.2 Conventions to Follow

| Category | Rule |
|----------|------|
| 날짜 | YYYY-MM-DD 문자열, 필드명 snake_case (`start_date`, `page_to`) |
| 에러 | 검증 실패 400 + 한국어 `{ error }` 메시지, 없는 리소스는 `NotFoundError` |
| UI | Tailwind, 기존 LongGoals 폼/목록 스타일 톤 유지 |

### 7.3 Environment Variables Needed

신규 환경변수 없음.

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`docs/02-design/features/reading-log.design.md`) — 소급 기록 검증 규칙, 예상일 계산식, 히트맵 색 단계 확정
2. [ ] 사용자 검토
3. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-24 | Initial draft | Mincoln Cho |
