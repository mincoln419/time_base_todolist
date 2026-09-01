---
template: design
version: 1.3
---

# daily-idea-note Design Document

> **Summary**: 신규 메뉴 "데일리노트"에서 키워드/카테고리/연관 키워드/항목 + 마크다운 본문(최대 2000자)으로 아이디어를 기록하고, 목록/캘린더/마인드맵 3가지 뷰로 탐색하는 기능의 설계
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-08-30
> **Status**: Draft
> **Planning Doc**: [daily-idea-note.plan.md](../../01-plan/features/daily-idea-note.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline(schema.md/conventions.md 등)을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 아이디어 메모가 구조 없이 흩어져 있어 나중에 주제별/시점별로 다시 찾기 어려움 |
| **WHO** | 이 앱을 혼자 쓰는 사용자 — 하루 동안 떠오른 아이디어를 그때그때 짧게 기록하고 나중에 되짚어보는 사람 |
| **RISK** | 카테고리/연관 키워드를 자유 텍스트로 둘 경우 오탈자로 인한 분산(마인드맵 연결 끊김), 마인드맵 레이아웃 알고리즘의 구현 난이도 |
| **SUCCESS** | 노트를 키워드/카테고리/연관 키워드/항목 + 마크다운 본문(최대 2000자)으로 저장할 수 있고, 캘린더 뷰에서 날짜별로, 마인드맵 뷰에서 키워드 연결로 각각 열람 가능 |
| **SCOPE** | (1) daily_notes 스키마 신설 (2) 서버 API 신설 (3) 데일리노트 입력 폼 UI (4) 캘린더 뷰 (5) 마인드맵 뷰 (6) 신규 메뉴 탭 등록 |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 1. Overview

### 1.1 Design Goals

- 아이디어를 키워드/카테고리/연관 키워드/항목이라는 구조화된 메타데이터 + 자유 마크다운 본문으로 저장한다.
- 저장된 노트를 "언제(날짜)"와 "무엇과 연결되는가(카테고리/키워드)" 두 축으로 재발견할 수 있게 한다.
- 신규 npm 의존성(캘린더 라이브러리, D3 등)을 도입하지 않고 기존 스택(React+Tailwind, marked+dompurify)만으로 구현한다.
- 기존 프로젝트 컨벤션(리소스당 API 1파일 + 라우트 1파일, 컴포넌트별 헬퍼 로컬 중복 선호)을 그대로 따른다.

### 1.2 Design Principles

- **컨벤션 재사용**: `tasks.js`/`focusmap.js`와 동일하게 라우트 1개 파일에 전체 CRUD를 모은다. `Calendar.jsx`의 `buildGrid`/`toDateString`/`WEEKDAYS` 패턴을 그대로 복제해 재사용한다(기존 프로젝트가 공용 유틸 추출보다 파일별 로컬 중복을 택해온 관례를 따름 — `App.jsx`와 `UnconsciousWorries.jsx`에도 동일한 `toDateString`이 각각 존재).
- **단순함 우선**: 인증, 페이지네이션, 실시간 동기화, 드래그 재배치, 물리 시뮬레이션(force-directed) 기반 마인드맵을 도입하지 않는다. 마인드맵은 결정론적(deterministic) 허브-스포크 레이아웃으로 단순화한다.
- **기존 기능 무변경**: `UnconsciousWorries.jsx`의 마크다운 렌더러(`renderMemoHtml` 등)를 import하지 않고, 데일리노트 전용으로 체크박스 인터랙션이 없는 더 단순한 렌더 함수를 새로 작성한다 — 기존 파일을 공용화 리팩터링하지 않아 회귀 위험이 없다.

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | `DailyNote.jsx` 한 파일에 폼+목록+캘린더+마인드맵 전부 구현 | 뷰별 컨테이너/훅/유틸을 세분화(뷰당 훅 분리, 마인드맵 레이아웃 계산기 별도 모듈화) | 뷰별 컴포넌트 4개로 분리하되 데이터 훅은 1개(`useDailyNotes`)로 통합, 마인드맵 레이아웃 계산은 컴포넌트 내부 순수 함수로 유지 |
| **New Files** | 1 | 8+ | 6 |
| **Modified Files** | 1 (`App.jsx`) | 1 | 1 |
| **Complexity** | Low (파일 하나가 비대해짐) | High (규모 대비 과설계) | Medium |
| **Maintainability** | Low (한 파일에 4가지 뷰 로직 혼재) | High (변경 지점 파편화로 오히려 추적 어려움) | High |
| **Effort** | Low | High | Medium |
| **Risk** | Medium (한 파일 비대화로 회귀 위험) | Low (구조는 깔끔하나 초기 개발 속도 저하) | Low |
| **Recommendation** | Quick wins | Long-term projects | **Default choice** |

**Selected**: **Option C — Pragmatic Balance**
**Rationale**: 뷰(목록/캘린더/마인드맵)는 렌더링 로직이 서로 크게 다르므로 컴포넌트를 분리하는 것이 가독성에 유리하다. 반면 이 프로젝트 규모(로컬 단일 사용자)에서 데이터 조회/생성/수정/삭제는 뷰와 무관하게 동일한 노트 목록 하나를 공유하므로, 훅은 `useDailyNotes` 하나로 충분하다(기존 `useFocusMapList`처럼 뷰별로 훅을 쪼갤 필요가 없음 — 데일리노트는 단일 리소스이고 focusmap처럼 "목록 요약 vs 상세 전체"의 응답 형태 차이가 없기 때문).

> 아래 상세 설계는 Option C를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌───────────────┐      ┌───────────────────────────┐      ┌──────────────┐
│ DailyNote 탭  │─────▶│ Express /api/daily-notes   │─────▶│ SQLite       │
│ (SPA)         │◀─────│ routes (GET/POST/PUT/DEL)  │◀─────│ daily_notes  │
└──────┬────────┘      └───────────────────────────┘      └──────────────┘
       │
       ├─▶ DailyNoteForm         (작성/수정 폼)
       ├─▶ DailyNoteList         (기본 목록 뷰, 마크다운 렌더링)
       ├─▶ DailyNoteCalendarView (월별 캘린더 뷰)
       └─▶ DailyNoteMindMapView  (카테고리/키워드 연결 마인드맵 뷰)
```

### 2.2 Data Flow

```
탭 진입 → useDailyNotes()로 전체 노트 목록 1회 로드 (뷰 전환 시 재조회하지 않고 클라이언트에서 필터링)
  → 입력 폼 제출 → POST /api/daily-notes → 성공 시 로컬 목록 앞에 추가 (낙관적 갱신 없이 응답 객체 그대로 반영)
  → 뷰 전환(목록/캘린더/마인드맵): 로컬 상태의 동일한 notes 배열을 각 뷰 컴포넌트에 전달, 뷰별로 파생 데이터만 계산
      · 캘린더: notes를 date별로 그룹핑(byDate)
      · 마인드맵: notes로 연결 그래프(edges) 계산 → 연결요소(component)별 허브-스포크 레이아웃 계산
  → 노트 수정: 목록/캘린더/마인드맵 상세 패널 어디서든 PUT /api/daily-notes/:id → 로컬 목록의 해당 항목 교체
  → 노트 삭제: DELETE /api/daily-notes/:id → 로컬 목록에서 제거
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `DailyNote.jsx` | `useDailyNotes` | 상단 뷰 전환 탭(목록/캘린더/마인드맵) + 입력 폼 컨테이너 |
| `DailyNoteForm.jsx` | (props로 notes/onCreate/onUpdate 수신) | 키워드/카테고리/연관 키워드/항목/본문 입력, 신규 작성 및 기존 노트 수정 겸용 |
| `DailyNoteList.jsx` | (props로만 데이터 수신) | 기본 목록 렌더링(마크다운 HTML 변환), 필터, 수정/삭제 트리거 |
| `DailyNoteCalendarView.jsx` | (props로만 데이터 수신) | 월별 그리드 + 날짜별 노트 개수/목록 |
| `DailyNoteMindMapView.jsx` | (props로만 데이터 수신) | 연결 그래프 계산 + SVG 렌더링 |
| `useDailyNotes.js` | `api/dailyNotes.js` | 노트 목록 조회/생성/수정/삭제 |

---

## 3. Data Model

### 3.1 Entity Definition

```
DailyNote
{
  id: number,
  date: string,               // "YYYY-MM-DD", 미지정 시 서버가 오늘 날짜로 채움
  keyword: string,             // 필수, 해시태그 스타일 다중 값을 쉼표(,)로 구분해 저장 (예: "습관, 아침루틴") — 1개 이상 필수
  category: string | null,     // 선택
  item: string | null,         // 선택 — 노트 제목/항목명, 목록·캘린더·마인드맵의 표시 라벨로 사용
  content: string | null,      // 마크다운 원문, 최대 2000자
  created_at: string,
  updated_at: string,
}
```

> **2026-09-01 amendment**: 원래 "키워드"(단일 필수)+"연관 키워드"(선택, 쉼표 다중) 2필드였으나, 사용자 요청으로 "키워드" 1필드가 해시태그처럼 다중 값을 갖도록 통합했다. 노트 하나가 여러 키워드를 가지고 하나의 키워드가 여러 노트에 걸릴 수 있어, 노트 간 마인드맵 연결이 자연스러운 n:n 관계가 된다. `related_keywords` 컬럼은 제거되었다(§3.3 참조).

- 표시 라벨 우선순위: `item` → 없으면 `keyword`의 첫 번째 태그 (목록/캘린더/마인드맵 공통 규칙, §5.3에서 `noteLabel(note)`/`noteKeywords(note)` 함수로 통일)
- `keyword`는 별도 정규화 테이블(예: `daily_note_keywords` n:n 조인 테이블) 없이 쉼표 구분 문자열 그대로 저장하고, 표시·연결 계산 시에만 `split(',').map(s => s.trim()).filter(Boolean)`으로 파싱한다 — 로컬 단일 사용자 SQLite 앱 규모에서 정규화 테이블은 과설계로 판단(Plan §7.2 결정과 동일한 원칙 적용)

### 3.2 Entity Relationships

```
[daily_notes]  ── (참조/FK 없음, 독립 테이블) ── 다른 어떤 테이블과도 연관 없음
```

다른 메뉴(할일, 장기목표 등)와의 데이터 연동은 Plan에서 Out of Scope로 확정했으므로 외래키/참조를 두지 않는다.

### 3.3 Database Schema

```sql
CREATE TABLE IF NOT EXISTS daily_notes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  date             TEXT    NOT NULL,
  keyword          TEXT    NOT NULL,
  category         TEXT,
  item             TEXT,
  content          TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date);
```

> 신규 테이블이므로 최초 생성 시 마이그레이션/이관 이슈 없음. `schema.sql`은 서버 시작 시 `CREATE TABLE IF NOT EXISTS`로 매번 실행되는 기존 방식(`db.exec()`)을 그대로 따르므로 `DROP TABLE`이 필요 없다.
>
> **2026-09-01 amendment**: `related_keywords` 컬럼 제거는 `CREATE TABLE IF NOT EXISTS`만으로는 기존 테이블에 반영되지 않으므로, `server/db/database.js`에 다른 마이그레이션들과 동일한 패턴(PRAGMA table_info로 구버전 컬럼 존재 확인 후 처리)으로 1회성 마이그레이션을 추가했다: `related_keywords` 컬럼이 남아있으면 그 값을 `keyword`에 병합(쉼표 join, 중복 제거)한 뒤 `ALTER TABLE ... DROP COLUMN related_keywords`로 제거한다.

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/daily-notes` | 노트 목록 조회 (`date`/`month` 쿼리로 필터 가능) | 없음 (로컬 단일 사용자) |
| POST | `/api/daily-notes` | 새 노트 생성 | 없음 |
| POST | `/api/daily-notes/extract-tags` | (2026-09-01 추가) 본문에서 AI로 카테고리/키워드 추출, DB 미저장 | 없음 (서버가 보관한 Anthropic API 키로 서버→Anthropic만 인증) |
| PUT | `/api/daily-notes/:id` | 노트 수정 | 없음 |
| DELETE | `/api/daily-notes/:id` | 노트 삭제 | 없음 |

### 4.2 Detailed Specification

#### `GET /api/daily-notes`

**Query Params**: `date` (YYYY-MM-DD, optional), `month` (YYYY-MM, optional) — 둘 다 없으면 전체 목록 반환. 둘 다 있으면 `date` 우선.

**Response (200):**
```json
[
  {
    "id": 5,
    "date": "2026-08-30",
    "keyword": "아침 루틴, 운동, 명상",
    "category": "습관",
    "item": "5분 스트레칭 아이디어",
    "content": "출근 전 5분 스트레칭...",
    "created_at": "2026-08-30 08:10:00",
    "updated_at": "2026-08-30 08:10:00"
  }
]
```
정렬: `date DESC, id DESC`

#### `POST /api/daily-notes`

**Request:**
```json
{
  "date": "2026-08-30",
  "keyword": "아침 루틴, 운동, 명상",
  "category": "습관",
  "item": "5분 스트레칭 아이디어",
  "content": "출근 전 5분 스트레칭..."
}
```
- `date` 생략 시 서버가 오늘 날짜(`localtime`)로 채움
- `keyword`는 쉼표(,)로 구분된 해시태그 스타일 다중 값 — 서버가 각 토큰을 trim·중복 제거해 다시 쉼표로 합쳐 저장(`normalizeKeyword`), 유효 토큰이 1개도 없으면 400
- `content` 2000자 초과 시 400

**Response (201 Created)**: 저장된 전체 객체(`id`, `created_at`, `updated_at` 포함, `keyword`는 정규화된 값)

**Error Responses:**
- `400` — keyword 누락/공백/쉼표만 입력: `{ "error": "키워드를 1개 이상 입력해주세요." }`
- `400` — content 2000자 초과: `{ "error": "내용은 2000자를 초과할 수 없습니다." }`

#### `POST /api/daily-notes/extract-tags` (2026-09-01 추가)

**Request:**
```json
{ "content": "아침에 일어나서 5분 스트레칭을 하면..." }
```
- `content` 필수 (trim 후 빈 문자열이면 400)

**서버 동작**: Anthropic Messages API(`@anthropic-ai/sdk`)를 `strict: true` 커스텀 툴(`extract_tags`) + `tool_choice`로 강제 호출해 `{ category, keywords }` 형태의 구조화된 JSON만 받는다. 모델은 `claude-sonnet-5`(사용자 지정), `output_config: { effort: "low" }`(분류/추출류 작업이라 낮은 effort로 충분 — 비용 절감). DB에는 저장하지 않고 결과만 그대로 응답한다.

**Response (200):**
```json
{ "category": "습관", "keywords": ["아침루틴", "스트레칭", "건강관리"] }
```

**Error Responses:**
- `400` — content 누락/공백: `{ "error": "추출할 내용이 없습니다." }`
- `500` — 서버에 API 키 미설정: `{ "error": "서버에 AI 키(CLAUDE_KEY)가 설정되지 않았습니다." }`
- `502` — Anthropic API 호출 실패(네트워크/인증/레이트리밋 등): `{ "error": "AI 태그 추출에 실패했습니다: ..." }`

#### `PUT /api/daily-notes/:id`

**Request**: POST와 동일한 필드(부분 갱신 아님, 전체 필드를 매번 전송하는 upsert 방식 — 기존 focusmap PUT과 동일한 관례)
**Response (200)**: 저장된 전체 객체 (`updated_at` 갱신됨)

**Error Responses:**
- `400` — keyword 정규화 후 빈 값 또는 content 2000자 초과 (POST와 동일 메시지)
- `404` — 존재하지 않는 id: `{ "error": "찾을 수 없습니다." }`

#### `DELETE /api/daily-notes/:id`

**Response**: `204 No Content`
**Error**: `404` — 존재하지 않는 id

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [일정관리] [포커스맵] ... [데일리노트]                              │  ← App.jsx 상단 탭 (기존, 항목만 추가)
├─────────────────────────────────────────────────────────────────┤
│ + 새 아이디어 작성   [목록] [캘린더] [마인드맵]                      │  ← 작성 버튼 + 뷰 전환 탭
├─────────────────────────────────────────────────────────────────┤
│ (선택된 뷰 렌더링 영역)                                             │
│                                                                   │
│  [목록 뷰]  최신순 카드 목록, 카드마다 키워드/카테고리/날짜 배지 +      │
│             마크다운 렌더링된 본문 + 수정/삭제 버튼                  │
│                                                                   │
│  [캘린더 뷰] 월 그리드, 노트 있는 날짜에 개수 배지, 날짜 클릭 시       │
│             하단/우측에 해당 날짜 노트 목록 패널                      │
│                                                                   │
│  [마인드맵 뷰] 카테고리/키워드로 연결된 노트 클러스터를 카드형          │
│             그리드로 배치, 각 카드 안에 허브-스포크 SVG,             │
│             노드 클릭 시 하단 상세 패널에 전체 내용 표시              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 User Flow

```
데일리노트 탭 진입 → useDailyNotes로 전체 노트 로드 → 기본 [목록] 뷰 표시
  ├─ "+ 새 아이디어 작성" 클릭 → 입력 폼 표시(키워드 필수, 나머지 선택) → 저장 → 목록 최상단에 반영
  ├─ [캘린더] 탭 클릭 → 월 그리드 렌더 → 날짜 클릭 → 해당 날짜 노트만 하단 패널에 표시
  │     → 패널에서 "+ 이 날짜에 작성" 클릭 시 date가 선택 날짜로 미리 채워진 입력 폼 열림
  └─ [마인드맵] 탭 클릭 → 연결 그래프 계산 → 클러스터 카드 그리드 렌더
        → 노드 클릭 → 하단 상세 패널에 해당 노트 전체 내용(마크다운 렌더링) 표시 → 상세 패널에서 수정/삭제 가능
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `DailyNote.jsx` | `client/src/components/DailyNote/` | 뷰 전환 탭 + 작성 폼 토글 상태 보유 |
| `noteUtils.js` | `client/src/components/DailyNote/` | `noteLabel(note)`/`noteKeywords(note)`/`renderNoteMarkdown(content)` 공용 함수 (2026-09-01 amendment — `DailyNote.jsx`가 export하고 하위 뷰가 다시 import하던 순환 참조를 제거하기 위해 별도 리프 모듈로 분리) |
| `DailyNoteForm.jsx` | `client/src/components/DailyNote/` | 키워드(해시태그 칩 입력)/카테고리/항목/본문 입력, 글자 수 카운터, 신규/수정 겸용. "태그추출(AI)" 버튼으로 서버 AI 추출 결과를 입력란에만 반영, "되돌리기" 버튼으로 마운트 시점 스냅샷(DB 값 또는 빈 초안)으로 복원 (2026-09-01 추가 — `App.jsx`가 `DailyNoteForm`에 `key={editingNote?.id ?? 'new'}`를 부여해 노트 전환 시 스냅샷이 새로 캡처되도록 함) |
| `DailyNoteList.jsx` | `client/src/components/DailyNote/` | 기본 목록, 마크다운 렌더링, 키워드/카테고리 필터 입력 |
| `DailyNoteCalendarView.jsx` | `client/src/components/DailyNote/` | 월 그리드(`buildGrid`/`toDateString`/`WEEKDAYS` 로컬 복제), 날짜별 그룹핑, 날짜 선택 패널 |
| `DailyNoteMindMapView.jsx` | `client/src/components/DailyNote/` | 연결 그래프 계산(§5.5) + SVG 클러스터 카드 렌더 + 상세 패널 |
| `useDailyNotes` | `client/src/hooks/` | 목록 조회·생성·수정·삭제, 로컬 state 갱신 |

### 5.4 Page UI Checklist

#### 공통 (DailyNote.jsx)

- [ ] 상단에 "+ 새 아이디어 작성" 버튼 — 클릭 시 `DailyNoteForm`을 신규 작성 모드로 표시/숨김 토글
- [ ] 뷰 전환 탭: `[목록] [캘린더] [마인드맵]` — 선택된 탭 강조(기존 `App.jsx` 탭 스타일과 통일)

#### 입력 폼 (DailyNoteForm)

- [x] 필드: 키워드(태그, 필수·1개 이상) · 카테고리(선택, text) · 항목(선택, text)
- [x] 키워드는 해시태그 칩 입력 — Enter 또는 쉼표로 태그 커밋, 칩의 × 버튼으로 삭제, 빈 입력에서 Backspace로 마지막 태그 삭제, blur 시 입력 중이던 텍스트도 자동 커밋 (2026-09-01 amendment — 기존 "키워드 단일 text input + 연관 키워드 쉼표 text input" 2필드를 이 칩 입력 1개로 통합)
- [x] 본문 textarea: `maxLength=2000`, `rows="8"`, `font-mono`, placeholder "마크다운 문법으로 자유롭게 기록 (AI가 정리한 내용을 붙여넣어도 좋습니다)"
- [x] 글자 수 카운터 `{content.length}/2000` (기존 `UnconsciousWorries.jsx` 패턴과 동일하게 `onChange`에서 `slice(0, 2000)`로 방어)
- [x] 저장/취소 버튼, 저장 성공 시 폼 닫힘 + 목록 최상단 반영
- [x] 키워드가 1개도 없을 때 제출 시 인라인 에러 메시지("키워드를 1개 이상 입력해주세요.")
- [x] (2026-09-01 추가) 본문 라벨 옆 "태그추출(AI)" 버튼 — 클릭 시 `POST /api/daily-notes/extract-tags` 호출, 응답의 `category`/`keywords`로 카테고리 입력란과 키워드 태그를 교체(프론트 상태만, 저장 전까지 DB 미반영). 내용이 비어있으면 인라인 에러("먼저 내용을 입력해주세요."), 호출 중 버튼 비활성화("추출 중...")
- [x] (2026-09-01 추가) "저장" 버튼 옆 "되돌리기" 버튼 — 클릭 시 폼 전체(날짜/카테고리/항목/본문/키워드)를 마운트 시점 스냅샷으로 즉시 복원(별도 API 호출 없음)

#### 목록 뷰 (DailyNoteList)

- [ ] 카드형 목록, 각 카드에 날짜/키워드/카테고리 배지, `noteLabel(note)` 제목, 마크다운 렌더링된 본문
- [ ] 카테고리 또는 키워드로 필터링하는 텍스트 입력
- [ ] 카드별 수정/삭제 버튼 (수정 클릭 시 `DailyNoteForm`이 해당 노트 값으로 채워져 인라인 또는 모달로 열림)
- [ ] 빈 상태: 노트가 없을 때 안내 문구

#### 캘린더 뷰 (DailyNoteCalendarView)

- [ ] 월 이동 버튼(◀ ▶), 현재 연-월 표시 (기존 `Calendar.jsx`와 동일한 톤)
- [ ] 요일 헤더 7칸 + 42칸 그리드 (기존 `buildGrid` 로직 재사용)
- [ ] 노트가 있는 날짜 셀에 개수 배지 표시, 오늘 날짜 강조
- [ ] 날짜 클릭 시 하단 패널에 해당 날짜 노트 목록(제목/키워드) 표시
- [ ] 하단 패널에 "+ 이 날짜에 작성" 버튼 — 클릭 시 `date`가 선택된 날짜로 초기화된 입력 폼 오픈

#### 마인드맵 뷰 (DailyNoteMindMapView)

- [ ] §5.5 알고리즘으로 계산된 연결요소(component)별 카드를 flex-wrap 그리드로 배치
- [ ] 각 카드: 허브 노드(가장 연결이 많은 노트)를 중심에, 나머지 노드를 원형으로 배치한 SVG, 허브-스포크 + 노드 간 실제 연결선
- [ ] 노드 클릭 시 하단 상세 패널에 전체 내용(마크다운 렌더링) 표시 + 수정/삭제 버튼
- [ ] 연결이 전혀 없는 노트(고립 노드)는 별도 "연결 없음" 섹션에 단일 카드로 나열
- [ ] 빈 상태: 노트가 없을 때 안내 문구

### 5.5 Mind Map Connection & Layout Algorithm

**연결(edge) 판정 규칙** (두 노트 A, B):
1. 카테고리 연결: `A.category`와 `B.category`가 모두 비어있지 않고, `trim()` 후 값이 같으면 연결
2. 키워드 연결: `keywordSet(note) = split(note.keyword, ',').map(trim).filter(Boolean)`(= `noteKeywords(note)`) 두 집합의 교집합이 비어있지 않으면 연결 — 한 노트가 태그를 여러 개 가지고 한 태그가 여러 노트에 걸릴 수 있으므로 이 규칙만으로 노트 간 관계가 자연스럽게 n:n이 된다 (2026-09-01 amendment — 기존에는 `keyword`(단일) ∪ `related_keywords`(다중)를 합쳐 집합을 만들었으나, 두 필드가 하나의 다중 `keyword`로 통합되며 정의가 단순해짐)
3. 두 규칙 중 하나라도 만족하면 edge 생성 (중복 연결은 1개로 취급)
4. 대소문자 구분 없이 비교하되(`toLowerCase()`), 원문은 그대로 표시에 사용

**레이아웃 계산**:
1. 위 규칙으로 무방향 그래프의 인접 리스트를 만들고, Union-Find(또는 BFS)로 연결요소(component)를 분리한다
2. `size === 1`인 component는 "연결 없음" 섹션으로 분리
3. `size >= 2`인 각 component에서 차수(degree)가 가장 높은 노드를 허브로 선택(동률이면 `id`가 작은 노드)
4. 허브를 카드 중심(cx, cy)에 배치, 나머지 노드는 `360 / (size - 1)`도 간격으로 원 위에 배치 (반지름은 카드 크기에 따른 고정값)
5. 허브-스포크 선 외에, 허브를 거치지 않는 노드 간 edge도 있으면 두 노드 좌표를 직선으로 추가 연결
6. 카드 크기는 `size`에 비례해 최소/최대 폭 사이에서 결정(예: 노드 6개 이하 고정 폭, 그 이상은 반지름 확대)

> 이 알고리즘은 물리 시뮬레이션 없이 O(N) 수준으로 계산 가능해 신규 의존성 없이 순수 JS로 구현할 수 있다. 노트 수가 많아져 가독성이 떨어지면 후속 개선 과제로 남긴다(Plan §5 Risk 참조).

---

## 6. Error Handling

### 6.1 Error Code Definition

기존 `tasks.js`/`focusmap.js`와 동일하게 `{ error: string }` 포맷을 유지한다.

| Status | 상황 | 메시지 |
|--------|------|--------|
| 400 | 정규화 후 유효 키워드 토큰이 0개인 상태로 생성·수정 시도 | `키워드를 1개 이상 입력해주세요.` |
| 400 | content가 2000자를 초과 | `내용은 2000자를 초과할 수 없습니다.` |
| 404 | 존재하지 않는 id로 수정/삭제 시도 | `찾을 수 없습니다.` |
| 400 | (2026-09-01) `extract-tags` 요청에 content 없음/공백 | `추출할 내용이 없습니다.` |
| 500 | (2026-09-01) 서버에 `CLAUDE_KEY`/`CLAUD_KEY` 미설정 상태로 `extract-tags` 호출 | `서버에 AI 키(CLAUDE_KEY)가 설정되지 않았습니다.` |
| 502 | (2026-09-01) Anthropic API 호출 실패 | `AI 태그 추출에 실패했습니다: ...` |
| 500 | 예상 못한 서버 오류 | 기존 `index.js` 공통 에러 핸들러가 처리 (변경 없음) |

### 6.2 Error Response Format

```json
{ "error": "키워드를 1개 이상 입력해주세요." }
```

---

## 7. Security Considerations

로컬 단일 사용자 앱으로 외부 노출/인증이 없는 기존 구조를 그대로 유지한다.

- [ ] 입력 검증: `keyword`는 trim 후 빈 문자열 여부 검사, `content`는 서버에서도 길이(2000자) 재검증
- [ ] 마크다운 렌더링 시 `DOMPurify.sanitize()`로 XSS 방지 (기존 `UnconsciousWorries.jsx`와 동일한 방어선, 체크박스 커스텀 렌더러는 이 기능에 불필요하므로 제외한 단순 버전 사용)
- [ ] SQL Injection: 기존과 동일하게 `db.prepare().run(...)` 파라미터 바인딩만 사용
- [ ] Rate Limiting / HTTPS: 해당 없음 (localhost 전용, 기존과 동일)
- [x] (2026-09-01 추가) Anthropic API 키(`CLAUDE_KEY`/`CLAUD_KEY`)는 서버 프로세스(`server/routes/dailyNotes.js`)에서만 `process.env`로 읽고, 어떤 API 응답에도 포함하지 않는다 — 클라이언트는 `content`만 보내고 결과(`category`/`keywords`)만 받는다
- [x] (2026-09-01 추가) 키는 리포 루트 `.env`에 저장하고 `server/index.js`에서 `dotenv`로 로드 — `.env`는 이미 `.gitignore`에 포함되어 커밋되지 않음(신규 추가 아님, 기존 상태 확인)

---

## 8. Test Plan

### 8.1 Test Scope

이 프로젝트는 자동화 테스트 도구가 설치되어 있지 않으므로(기존 focusmap/warroom 구현 때와 동일), Do 단계에서도 **수동 시나리오 검증**으로 대체한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API 확인 | 4개 엔드포인트 — 상태 코드/응답 형태 | `curl` 수동 실행 | Do |
| L2: UI 동작 확인 | §5.4 체크리스트 요소 | 브라우저 수동 조작 (claude-in-chrome 등) | Do |
| L3: E2E 시나리오 | 작성→목록/캘린더/마인드맵 교차 확인 | 브라우저 수동 조작 | Do/Check |

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | 설명 | 기대 상태 | 기대 응답 |
|---|----------|--------|------|:--------:|-----------|
| 1 | `/api/daily-notes` | GET | 빈 상태 조회 | 200 | `[]` |
| 2 | `/api/daily-notes` | POST | keyword 없이 생성 시도 | 400 | `.error` 존재 |
| 3 | `/api/daily-notes` | POST | content 2001자로 생성 시도 | 400 | `.error` 존재 |
| 4 | `/api/daily-notes` | POST | 정상 생성(date 생략) | 201 | `.date`가 오늘 날짜 |
| 5 | `/api/daily-notes` | GET | `?date=YYYY-MM-DD` 필터 | 200 | 해당 날짜 노트만 반환 |
| 6 | `/api/daily-notes` | GET | `?month=YYYY-MM` 필터 | 200 | 해당 월 노트만 반환 |
| 7 | `/api/daily-notes/:id` | PUT | 필드 갱신 | 200 | 갱신 값 반영, `updated_at` 변경 |
| 8 | `/api/daily-notes/:id` | DELETE | 삭제 | 204 | 이후 GET 목록에서 제외 |
| 9 | `/api/daily-notes/:id` | PUT | 없는 id 수정 시도 | 404 | `.error` 존재 |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | 데일리노트 탭 | "+ 새 아이디어 작성" → 키워드만 입력 후 저장 | 목록 최상단에 새 카드 표시 | `GET /api/daily-notes`에 존재 |
| 2 | 데일리노트 탭 | 본문에 2000자 초과 입력 시도 | 입력이 2000자에서 멈춤, 카운터 `2000/2000` | 없음 |
| 3 | 데일리노트 탭 | 본문에 마크다운(`# 제목`, `- 목록`) 입력 후 저장 | 목록에서 해당 문법이 HTML로 렌더링됨 | 없음 |
| 4 | 캘린더 뷰 | 노트 있는 날짜 클릭 | 하단 패널에 해당 날짜 노트만 표시 | 개수 배지와 실제 목록 개수 일치 |
| 5 | 마인드맵 뷰 | 같은 카테고리로 노트 2개 작성 후 진입 | 두 노드가 한 클러스터 카드에 연결선으로 표시 | 없음 |
| 6 | 마인드맵 뷰 | 노드 클릭 | 하단 상세 패널에 전체 내용 렌더링 | 없음 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 작성 → 3뷰 교차 확인 | 오늘 날짜로 노트 작성 → 목록에서 확인 → 캘린더에서 오늘 날짜에 배지 확인 → 마인드맵에서 고립 노드로 표시 확인 | 3개 뷰 모두 동일 노트를 일관되게 표시 |
| 2 | 키워드 연결 확인 | 노트 A(`키워드: 습관`) 작성 → 노트 B(`연관 키워드: 습관, 아침`) 작성 → 마인드맵 진입 | A-B가 같은 클러스터 카드에서 연결선으로 표시 |
| 3 | 수정/삭제 회귀 | 노트 하나를 목록에서 수정 → 캘린더/마인드맵에서 갱신된 내용 확인 → 삭제 → 3뷰 모두에서 제거 확인 | 어느 뷰에서 조작하든 다른 뷰에 즉시 반영 |

### 8.5 Seed Data Requirements

없음 — Do/Check 단계에서 수동으로 노트 3~5건(카테고리/연관 키워드 겹치는 경우 포함)을 생성해 검증한다.

---

## 9. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다.

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/이벤트 처리 | `client/src/components/DailyNote/` |
| **Application (Hooks)** | 노트 목록 로드·생성·수정·삭제 오케스트레이션 | `client/src/hooks/useDailyNotes.js` |
| **Infrastructure** | HTTP 통신, DB 접근 | `client/src/api/dailyNotes.js`, `server/routes/dailyNotes.js` |
| **Domain** | 노트 shape(§3.1), 연결 그래프 계산 규칙(§5.5) | 별도 타입 파일 없이 JSDoc + `DailyNoteMindMapView.jsx` 내부 순수 함수로 문서화 |

### 9.2 Dependency Rules

```
컴포넌트(Presentation) ──▶ 훅(Application) ──▶ api 모듈(Infrastructure) ──▶ fetch
훅은 컴포넌트를 import하지 않는다 (단방향, 기존 useTasks/useFocusMap과 동일한 규칙)
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `DailyNote.jsx` | Presentation | `client/src/components/DailyNote/DailyNote.jsx` |
| `DailyNoteForm.jsx` | Presentation | `client/src/components/DailyNote/DailyNoteForm.jsx` |
| `DailyNoteList.jsx` | Presentation | `client/src/components/DailyNote/DailyNoteList.jsx` |
| `DailyNoteCalendarView.jsx` | Presentation | `client/src/components/DailyNote/DailyNoteCalendarView.jsx` |
| `DailyNoteMindMapView.jsx` | Presentation | `client/src/components/DailyNote/DailyNoteMindMapView.jsx` |
| `noteUtils.js` | Presentation (공용 헬퍼) | `client/src/components/DailyNote/noteUtils.js` |
| `useDailyNotes` | Application | `client/src/hooks/useDailyNotes.js` |
| `api/dailyNotes.js` | Infrastructure | `client/src/api/dailyNotes.js` |
| `routes/dailyNotes.js` | Infrastructure | `server/routes/dailyNotes.js` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다: 컴포넌트 PascalCase, 훅 `useXxx` camelCase, 함수 camelCase, 폴더는 기능 단위 PascalCase(`DailyNote/`). 라우트 파일명은 기존 관례(`focusmap.js`, `warroom.js`)를 따라 소문자 `dailyNotes.js` 대신 **`dailyNotes.js`(camelCase)**로 통일 — 기존 `routes/` 디렉터리에 `tasks.js`, `schedules.js`, `focusmap.js`, `warroom.js`처럼 짧은 소문자 파일명이 관례이므로 라우트 파일은 `server/routes/dailyNotes.js`로 생성한다.

### 10.2 Import Order

기존 파일들의 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다. 강제 ESLint/Prettier 설정 없음.

### 10.3 Environment Variables

신규 환경변수 없음 — 기존 `PORT`, `DB_PATH`를 재사용한다.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 리소스당 파일 수 | API 1파일(`dailyNotes.js`) + 라우트 1파일(`dailyNotes.js`)에 전체 CRUD, `tasks.js`/`focusmap.js`와 동일 |
| 마크다운 렌더링 | `UnconsciousWorries.jsx`를 import하지 않고 `marked`+`dompurify`로 데일리노트 전용 단순 렌더 함수를 작성. 목록/캘린더/마인드맵 3개 뷰가 동일 함수를 필요로 해 `noteUtils.js` 공용 모듈로 분리(2026-09-01 amendment — 최초에는 `DailyNote.jsx`가 export하고 하위 뷰가 다시 import하는 구조였으나 순환 참조로 판명되어 리프 모듈로 이동) |
| 캘린더 그리드 | `Calendar.jsx`의 `buildGrid`/`toDateString`/`WEEKDAYS`를 import하지 않고 `DailyNoteCalendarView.jsx`에 동일 로직을 로컬로 복제(기존 프로젝트가 이미 여러 파일에서 `toDateString`을 각자 정의해온 관례를 따름) |
| 상태 관리 | 로컬 React state + custom hook, 전역 스토어 도입 안 함 |
| 에러 처리 | `{ error: string }` 한국어 메시지, 기존 라우트와 동일 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
server/
├── db/schema.sql                          (수정 — daily_notes 테이블 + 인덱스 추가)
├── routes/dailyNotes.js                   (신규 — GET/, POST/, PUT/:id, DELETE/:id, 2026-09-01: POST /extract-tags 추가)
├── index.js                               (수정 — /api/daily-notes 라우터 등록, 2026-09-01: 최상단에 dotenv.config() 추가)
├── package.json                            (수정, 2026-09-01 — 의존성 `@anthropic-ai/sdk`, `dotenv` 추가)
.env                                        (신규, 2026-09-01 — 리포 루트, `CLAUDE_KEY`/`CLAUD_KEY`. 이미 `.gitignore`에 포함)
client/src/
├── api/dailyNotes.js                      (신규 — list/create/update/remove 4개 함수, 2026-09-01: extractTags 추가)
├── hooks/useDailyNotes.js                 (신규)
└── components/DailyNote/
    ├── DailyNote.jsx                       (신규 — 뷰 전환 컨테이너)
    ├── DailyNoteForm.jsx                   (신규)
    ├── DailyNoteList.jsx                   (신규)
    ├── DailyNoteCalendarView.jsx           (신규)
    ├── DailyNoteMindMapView.jsx            (신규)
    └── noteUtils.js                        (신규 — noteLabel/noteKeywords/renderNoteMarkdown 공용 함수, 2026-09-01 순환 참조 제거로 추가)
├── App.jsx                                (수정 — TABS에 dailynote 추가 + 탭 렌더 분기 추가)
```

### 11.2 Implementation Order

1. [ ] `server/db/schema.sql` — `daily_notes` 테이블 + `idx_daily_notes_date` 인덱스 추가
2. [ ] `server/routes/dailyNotes.js` — 4개 엔드포인트 구현 (keyword 검증, content 2000자 검증, date 기본값 처리)
3. [ ] `server/index.js` — 라우터 등록 (`app.use('/api/daily-notes', require('./routes/dailyNotes'))`)
4. [ ] `client/src/api/dailyNotes.js` — fetch 래퍼 4개 함수
5. [ ] `client/src/hooks/useDailyNotes.js` — 목록 로드 + CRUD 후 로컬 state 갱신
6. [ ] `client/src/components/DailyNote/DailyNoteForm.jsx` — 입력 필드 + 2000자 카운터 + 신규/수정 겸용
7. [ ] `client/src/components/DailyNote/DailyNoteList.jsx` — 마크다운 렌더 함수 + 카드 목록 + 필터
8. [ ] `client/src/components/DailyNote/DailyNoteCalendarView.jsx` — 월 그리드 + 날짜별 그룹핑 + 상세 패널
9. [ ] `client/src/components/DailyNote/DailyNoteMindMapView.jsx` — §5.5 연결/레이아웃 알고리즘 + SVG 렌더 + 상세 패널
10. [ ] `client/src/components/DailyNote/DailyNote.jsx` — 뷰 전환 탭 + 작성 폼 토글 조립
11. [ ] `client/src/App.jsx` — `TABS`에 `{ id: 'dailynote', label: '데일리노트' }` 추가, 탭 분기 렌더 추가
12. [ ] §8.2~8.4 수동 시나리오 검증

### 11.3 Session Guide

> Session 1(Plan+Design)은 본 문서로 완료. `/pdca do daily-idea-note --scope module-N`으로 모듈별 구현 가능.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---:|
| 백엔드 (스키마+API) | `module-1` | `schema.sql`, `routes/dailyNotes.js`, `index.js` 등록 | 8-10 |
| 클라이언트 데이터층 | `module-2` | `api/dailyNotes.js`, `useDailyNotes.js` | 5-6 |
| 입력 폼 + 목록 뷰 | `module-3` | `DailyNoteForm.jsx`, `DailyNoteList.jsx`, `DailyNote.jsx`, `App.jsx` 탭 등록 | 12-15 |
| 캘린더 뷰 | `module-4` | `DailyNoteCalendarView.jsx` | 8-10 |
| 마인드맵 뷰 | `module-5` | `DailyNoteMindMapView.jsx` (§5.5 알고리즘 포함, 난이도 높음) | 12-15 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 (본 문서) |
| Session 2 | Do | `--scope module-1,module-2,module-3` | 25-30 |
| Session 3 | Do | `--scope module-4,module-5` | 20-25 |
| Session 4 | Check + Report | 전체 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-30 | Initial draft (Option C 선택) | Mincoln Cho |
| 0.2 | 2026-09-01 | 키워드를 해시태그 스타일 다중 값으로 변경, "연관 키워드" 필드/컬럼 제거 후 "키워드"로 통합(§3.1/§3.3/§4.2/§5.4/§5.5/§10.4 갱신). `noteLabel`/`renderNoteMarkdown`을 `DailyNote.jsx` 순환 참조에서 `noteUtils.js` 공용 모듈로 분리(§5.3/§9.3/§11.1 갱신) | Mincoln Cho |
| 0.3 | 2026-09-01 | `POST /api/daily-notes/extract-tags` 추가 — Anthropic API(Claude, strict tool use)로 본문에서 카테고리/키워드 추출, DB 미저장(§4.1/§4.2 갱신). 폼에 "태그추출(AI)"·"되돌리기" 버튼 추가(§5.3/§5.4 갱신), API 키 취급 보안 항목 추가(§7 갱신), `@anthropic-ai/sdk`+`dotenv` 의존성 및 리포 루트 `.env` 추가(§11.1 갱신) | Mincoln Cho |
