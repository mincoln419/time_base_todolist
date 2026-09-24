---
template: design
version: 1.2
---

# reading-log Design Document

> **Summary**: 신규 메뉴 "독서기록"의 데이터 모델(readingBooks/readingLogs), REST API, 진행도·예상일·잔디 계산 규칙, 화면 구성을 확정한다
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-24
> **Status**: Draft
> **Planning Doc**: [reading-log.plan.md](../../01-plan/features/reading-log.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 여러 권 병행 독서 시 책별 진행도·완독 예상일·매일 읽었는지 여부를 따로 추적하기 어려움 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 하루 10페이지 이상을 목표로 여러 권을 동시에 읽는 사람 |
| **RISK** | 소급 기록 시 페이지 역전, 예상일 계산 규칙의 직관성, 타임존에 의한 날짜 밀림 |
| **SUCCESS** | 책 행 추가 → 남은 일수·예상일 표시, 날마다 체크 + 도달 페이지로 갱신, 잔디 히트맵으로 점검 |
| **SCOPE** | readingBooks/readingLogs, `/api/reading` API, ReadingLog 화면(등록 폼·체크리스트·책 목록·남은 책·완독), 잔디 히트맵, 탭/백업 등록 |

---

## 1. Overview

### 1.1 Design Goals

- 기록(log)은 "그날 몇 페이지까지 읽었는가(`page_to`)" 하나만 저장하고, 현재 페이지·그날 읽은 양·완독 여부·예상일은 전부 기록에서 **계산**한다.
- 책×날짜당 기록 1건 — 체크 = upsert, 체크 해제 = delete로 할일 목록과 같은 조작감.
- 신규 라이브러리 없이 기존 longgoals/worries 패턴(전체 로드 → 변경 후 reload)을 그대로 따른다.

### 1.2 Design Principles

- 서버는 **정합성 검증**(페이지 단조 증가, 범위, 날짜 형식)과 `finished_at` 재계산만 담당, 표시용 파생값은 클라이언트 순수 함수(`readingCalc.js`)가 담당.
- 날짜는 항상 로컬 기준 `YYYY-MM-DD` 문자열. `toISOString()`으로 "오늘"을 만들지 않는다.

---

## 2. Architecture

### 2.1 Component Diagram

```
┌──────────────────────────────┐   fetch    ┌───────────────────────┐    firebase-admin   ┌──────────────┐
│ ReadingLog.jsx               │──────────▶│ routes/reading.js     │───────────────────▶│ readingBooks │
│  ├ ReadingHeatmap.jsx        │ /api/     │  (검증 + finished_at   │                    │ readingLogs  │
│  └ useReading → api/reading  │ reading   │   재계산)              │                    └──────────────┘
│  readingCalc.js (파생값 계산) │◀──────────│                        │
└──────────────────────────────┘   JSON    └───────────────────────┘
```

### 2.2 Data Flow

```
책 등록/체크/해제 → API → Firestore 쓰기 + finished_at 재계산 → 클라이언트 reload(GET /books)
→ readingCalc로 current_page / 상태 / 남은 일수 / 예상일 / 날짜별 합계 계산 → 렌더
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `routes/reading.js` | `db/firestore`, `db/collections`, `db/util` | CRUD + 검증 |
| `ReadingLog.jsx` | `useReading`, `readingCalc`, `DateNavigator` | 화면 |
| `ReadingHeatmap.jsx` | `readingCalc.dailyTotals` | 잔디 |

---

## 3. Data Model

### 3.1 Entity Definition

```js
// readingBooks/{id}
{
  id: number,            // _counters/readingBooks
  title: string,
  total_pages: number,   // ≥ 1 정수
  start_page: number,    // 등록 시점에 이미 읽은 페이지, 0 ≤ start_page ≤ total_pages
  start_date: 'YYYY-MM-DD',
  daily_target: number,  // 1 이상 정수, 기본 10 — 책마다 설정 (기존 책은 모두 10)
  due_date: 'YYYY-MM-DD' | null,  // 반납일(선택), start_date 이후
  finished_at: 'YYYY-MM-DD' | null,  // 총 페이지에 도달한 기록의 날짜 (서버가 재계산)
  created_at: 'YYYY-MM-DD HH:MM:SS',
  updated_at: 'YYYY-MM-DD HH:MM:SS',
}

// readingLogs/{book_id}_{date}
{
  id: '12_2026-09-24',   // 문서 ID와 동일 — 백업 import가 doc(String(row.id))로 복원하므로 필수
  book_id: number,
  date: 'YYYY-MM-DD',
  page_to: number,       // 그날 도달한 페이지
  created_at: string,
  updated_at: string,
}
```

### 3.2 Entity Relationships

```
[readingBooks] 1 ──── N [readingLogs]   (book_id, 책×날짜 유일)
```

### 3.3 파생값 계산 규칙 (`client/src/utils/readingCalc.js`)

| 값 | 규칙 |
|----|------|
| `logs` | 책의 기록을 `date` 오름차순 정렬 |
| `currentPage(book)` | 마지막 기록의 `page_to`, 기록이 없으면 `start_page` (단조 증가가 서버에서 보장되므로 max와 같음) |
| `pageBefore(book, date)` | `date` 이전 마지막 기록의 `page_to`, 없으면 `start_page` |
| `pagesOn(book, date)` | 그날 기록의 `page_to − pageBefore(book, date)` (기록 없으면 0) |
| `status(book, today)` | `finished_at` 있으면 `done` / `start_date > today`면 `planned` / 그 외 `reading` |
| `daysLeft(book)` | `ceil((total − current) / daily_target)`, 완독이면 0 |
| `targetForDueDate(book, today)` | `ceil((total − current) ÷ (from ~ due_date 일수))`, `from` = 오늘(오늘 기록 있으면 내일, 예정 책은 시작일). 반납일이 지났으면 null. 대출 기간 등 고정 상수 없음 |
| `eta(book, today)` | `base + daysLeft − 1`. `base` = planned면 `start_date`, 오늘 기록이 있으면 내일, 아니면 오늘 |
| `missedDays(book, today)` | `start_date` ~ 어제 사이(완독일 이후 제외) 기록이 없는 날 수 |
| `dailyTotals(books)` | `Map<date, { pages, items: [{ title, pages }] }>` — 모든 책의 `pagesOn` 합 |
| `todayString()` / `addDays(date, n)` | 로컬 날짜 기준 문자열 연산 (`new Date(y, m-1, d)` 사용) |

예) 300p 책, 현재 120p → 남은 180p → 18일. 오늘 체크 전이면 오늘 포함 18일째가 예상일, 오늘 30p를 읽으면(150p) 15일 남고 내일부터 셈. 하루 빼먹으면 남은 일수는 그대로이고 base가 하루 뒤로 가서 예상일이 하루 밀린다.

---

## 4. API Specification

Base: `/api/reading` (`server/index.js`에 등록)

### 4.1 Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| GET | `/books` | 전체 책 + 각 책의 logs(날짜 오름차순) |
| POST | `/books` | 책 추가 |
| PATCH | `/books/:id` | 제목·총 페이지·시작 페이지·시작일 수정 |
| DELETE | `/books/:id` | 책 + 해당 logs 삭제 (204) |
| PUT | `/books/:id/logs/:date` | 그날 도달 페이지 upsert (체크) |
| DELETE | `/books/:id/logs/:date` | 그날 기록 삭제 (체크 해제, 204) |

### 4.2 Detailed Specification

#### `GET /books`

```json
{ "books": [ { "id": 1, "title": "...", "total_pages": 320, "start_page": 0, "start_date": "2026-09-20",
               "daily_target": 10, "finished_at": null, "logs": [ { "date": "2026-09-20", "page_to": 12 } ] } ] }
```

logs는 `readingLogs` 전체를 한 번 읽어 `book_id`로 묶는다(데이터 양이 적음 — worries와 동일 방식).

#### `POST /books`

Request: `{ "title": "사피엔스", "total_pages": 636, "start_page": 40, "start_date": "2026-09-24" }`

검증 (실패 시 400):
- `title` 공백 불가 → "책 제목을 입력해주세요."
- `total_pages` 1 이상 정수 → "총 페이지는 1 이상의 정수로 입력해주세요."
- `start_page` 0 이상 `total_pages` 이하 정수 (미지정 0) → "현재 페이지는 0 ~ 총 페이지 사이로 입력해주세요."
- `start_date` YYYY-MM-DD (미지정 시 서버 로컬 오늘)

`start_page === total_pages`면 `finished_at = start_date`. Response 201: 생성된 책(+ `logs: []`).

#### `PATCH /books/:id`

부분 수정. 검증은 POST와 동일하되 추가로:
- `start_page`는 첫 기록의 `page_to` 이하여야 함 → "시작 페이지가 이미 기록된 페이지보다 큽니다."
- `total_pages`는 마지막 기록의 `page_to` 이상이어야 함 → "총 페이지가 이미 읽은 페이지보다 작습니다."
- `start_date`는 첫 기록 날짜 이하여야 함 → "시작일 이전의 기록이 있습니다."

저장 후 `finished_at` 재계산. Response 200: 책(+logs).

#### `PUT /books/:id/logs/:date`

Request: `{ "page_to": 52 }`

검증 (실패 시 400):
- `date` YYYY-MM-DD, `start_date` ≤ date ≤ 서버 로컬 오늘 → "시작일부터 오늘까지만 기록할 수 있습니다."
- `page_to` 정수, `pageBefore(date)` < page_to ≤ `total_pages` → "이전 기록(Np)보다 크고 총 페이지 이하로 입력해주세요."
- 다음 날짜 기록이 있으면 page_to ≤ 그 기록의 page_to → "이후 기록(Np)보다 클 수 없습니다."

→ 소급 기록·수정 시에도 페이지가 날짜순으로 단조 증가하도록 보장(Plan §5 역전 리스크 해소).

트랜잭션 안에서 책 + 해당 책 logs를 읽고 검증 → log set → `finished_at` 재계산 후 책 갱신. Response 200: 책(+logs).

#### `DELETE /books/:id/logs/:date`

기록 삭제 후 `finished_at` 재계산. 없는 기록이면 404. Response 204.

#### `finished_at` 재계산 (서버 헬퍼)

```
logs 오름차순에서 page_to ≥ total_pages 인 첫 기록의 date
없으면 start_page ≥ total_pages ? start_date : null
```

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ 잔디 (최근 1년, 53주 × 7일)          총 N일 읽음 · 이번 달 M일 · 연속 K일 │
│ ▢▢▣▣▢▣■ ...                                               적음 ▢▣▣■ 많음 │
├───────────────────────────────┬────────────────────────────────────────┤
│ 오늘의 독서  ◀ [2026-09-24] ▶ │ 책 추가                                 │
│ ☑ 사피엔스   40 → 52p (+12)   │ [제목                              ]    │
│ ☐ 코스모스   도달 [ 130 ] 체크 │ [시작일] [현재 p] [총 p]  [추가]        │
│ ...                           │  → 약 60일 소요 · 예상 완독 2026-11-22  │
│                               ├────────────────────────────────────────┤
│                               │ 남은 책 (읽는 중 / 읽을 예정)           │
│                               │ 사피엔스  ████░░░ 52/636 (8%)          │
│                               │   59일 남음 · 예상 11-21 · 놓친 날 2일  │
│                               │ [예정] 총균쇠  0/750 · 10-01 시작       │
│                               ├────────────────────────────────────────┤
│                               │ ▸ 완독 (3)                              │
└───────────────────────────────┴────────────────────────────────────────┘
```

레이아웃: `max-w-7xl mx-auto p-4`, 히트맵 섹션 전체 폭 → 아래 `grid xl:grid-cols-[minmax(0,1fr)_420px]`. 섹션 스타일은 LongGoals와 동일(`bg-white border rounded p-4`).

### 5.2 User Flow

```
책 추가 폼 입력 → 예상 미리보기 → [추가] → 남은 책 목록에 행 추가
매일: 오늘의 독서에서 책별로 도달 페이지 확인(기본 +10) → [체크] → 진행 바·예상일·잔디 갱신
빼먹은 날: 잔디 칸 클릭 또는 날짜 이동 → 해당 날짜로 체크 (소급)
체크 해제: 체크박스 해제 → 그날 기록 삭제
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `ReadingLog` | `client/src/components/ReadingLog/ReadingLog.jsx` | 메뉴 루트, 선택 날짜 상태, 등록 폼, 체크리스트, 남은 책/완독 목록, 책 수정(인라인 편집 — LongGoals 편집 패턴) |
| `ReadingHeatmap` | `client/src/components/ReadingLog/ReadingHeatmap.jsx` | 잔디 그리드, hover `title` 툴팁, 칸 클릭 → `onSelectDate(date)` |
| `useReading` | `client/src/hooks/useReading.js` | 로드 + `reloadAfter` 래핑 (useLongGoals 패턴) |
| `api/reading.js` | `client/src/api/reading.js` | fetch 래퍼 (`readJsonOrThrow` 패턴) |
| `readingCalc.js` | `client/src/utils/readingCalc.js` | §3.3 순수 함수 |

### 5.4 세부 동작

**오늘의 독서 체크리스트** (선택 날짜 D 기준)
- 대상: `start_date ≤ D` 이고 (`finished_at` 없음 또는 `finished_at ≥ D`) 인 책. D가 오늘이면 planned 책은 제외.
- 기록 있음: ☑ + "`pageBefore` → `page_to`p (+N)" 표시. N < 10이면 amber 뱃지 "목표 미달". 페이지 숫자 클릭 시 입력창으로 전환해 수정(PUT).
- 기록 없음: ☐ + 도달 페이지 number input(기본 `min(pageBefore + 10, total)`) + [체크] 버튼. 체크박스 클릭 = [체크]와 동일.
- ☑ 해제 → DELETE.
- 날짜 이동은 `DateNavigator` 재사용, 미래 날짜로는 이동 불가(▶ 비활성 대신 오늘로 clamp).

**책 추가 폼 미리보기**: 입력값으로 `daysLeft`/`eta`를 즉시 계산해 "약 N일 소요 · 예상 완독 YYYY-MM-DD" 표시.

**남은 책 목록**: reading(남은 일수 오름차순) → planned(시작일 오름차순). 행: 제목, 진행 바, `current/total (%)`, "N일 남음 · 예상 MM-DD", 놓친 날 > 0이면 "놓친 날 N일"(gray). 수정(연필)/삭제 버튼.

**완독 목록**: `<details>`로 접힘, `finished_at` 내림차순, "시작일 ~ 완독일 (N일)".

**잔디 히트맵**
- 범위: 오늘이 속한 주의 토요일을 끝으로 53주(일요일 시작 열). 오늘 이후 칸은 비움.
- 색 단계 (그날 전체 책 페이지 합):

| pages | class |
|-------|-------|
| 0 | `bg-gray-100` |
| 1–9 (미달) | `bg-emerald-100` |
| 10–19 | `bg-emerald-300` |
| 20–39 | `bg-emerald-500` |
| 40+ | `bg-emerald-700` |

- 칸 크기 `w-3 h-3 rounded-sm gap-[3px]`, 상단 월 라벨, 좌측 월/수/금 라벨, 좁은 화면에선 `overflow-x-auto`.
- `title` 툴팁: "2026-09-24 · 22p\n사피엔스 12p, 코스모스 10p".
- 선택 날짜 칸은 `ring-2 ring-blue-400`.
- 요약: 총 읽은 날 수, 이번 달 읽은 날 수, 현재 연속일(오늘 기록 없으면 어제부터 셈).

---

## 6. Error Handling

| Code | Cause | Handling |
|------|-------|----------|
| 400 | 검증 실패 (§4.2 메시지) | 클라이언트 `alert(err.message)` (기존 패턴) |
| 404 | 없는 책/기록 | `NotFoundError` → 404 |
| 500 | Firestore 오류 | 공통 에러 미들웨어 |

응답 형식: `{ "error": "한국어 메시지" }`

---

## 7. Security Considerations

- 로컬 단일 사용자 앱, 인증 없음(기존과 동일). Firestore는 서버에서만 접근.
- 숫자 입력은 서버에서 `Number.isInteger` 검증, 문자열은 trim.

---

## 8. Test Plan (수동)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 300p / 현재 120p 책 추가 | 18일 남음, 예상일 = 오늘 + 17 |
| 2 | 오늘 150p로 체크 | 15일 남음, 예상일 = 내일 + 14, 잔디 오늘 칸 emerald-500 |
| 3 | 오늘 체크 해제 | 18일 남음으로 복귀, 잔디 비움 |
| 4 | 어제 칸 클릭 → 125p 소급 기록 후 오늘 기록 130p | 어제 +5(미달), 오늘 +5 |
| 5 | 어제 기록을 오늘 기록보다 크게 수정 | 400 "이후 기록(Np)보다 클 수 없습니다." |
| 6 | 총 페이지까지 기록 | 완독 목록으로 이동, finished_at = 그 날짜 |
| 7 | 시작일이 미래인 책 추가 | "읽을 예정"에 표시, 오늘 체크리스트엔 없음 |
| 8 | 독서기록 백업 → 전체 삭제 → 복원 | 책·기록 동일 복원 |
| 9 | 기존 탭 이동/뒤로가기 | 회귀 없음 |

---

## 9. Implementation Guide

### 9.1 File Structure

```
server/
├── db/collections.js           # READING_BOOKS: 'readingBooks', READING_LOGS: 'readingLogs', COUNTER_KEYS.READING_BOOKS
├── routes/reading.js           # 신규
├── routes/backup.js            # reading_books / reading_logs + BACKUP_TYPES.reading
└── index.js                    # app.use('/api/reading', ...)
client/src/
├── api/reading.js
├── hooks/useReading.js
├── utils/readingCalc.js
├── components/ReadingLog/ReadingLog.jsx
├── components/ReadingLog/ReadingHeatmap.jsx
└── App.jsx                     # TABS에 { id: 'reading', label: '독서기록' } + 렌더
```

백업: `SIMPLE_TABLES`에 `reading_books: READING_BOOKS`, `reading_logs: READING_LOGS` 추가, `full.tables/deleteTables`에 포함, `reading: { label: '독서기록', tables: ['reading_books','reading_logs'], deleteTables: ['reading_logs','reading_books'] }` 추가. logs 문서에 `id` 필드가 있어 기존 `importTable` 로직을 그대로 사용한다.

### 9.2 Implementation Order

1. [ ] `collections.js` 상수 추가
2. [ ] `routes/reading.js` (검증 헬퍼, finished_at 재계산) + `index.js` 등록
3. [ ] `backup.js` 스코프 추가
4. [ ] `readingCalc.js` 순수 함수
5. [ ] `api/reading.js` + `hooks/useReading.js`
6. [ ] `ReadingLog.jsx` (등록 폼 → 남은 책/완독 → 체크리스트)
7. [ ] `ReadingHeatmap.jsx`
8. [ ] `App.jsx` 탭 등록
9. [ ] §8 수동 테스트 + `npm run build`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-24 | Initial draft | Mincoln Cho |
