---
template: design
version: 1.2
---

# reading-log-mobile Design Document

> **Summary**: Flutter 독서기록 앱(`mobile/`, 패키지 `com.codenyang.readinglog`)의 Firestore 데이터 구조·보안 규칙, 오프라인 쓰기 방식, 도메인 계산/검증 이식, 인증·계정 삭제, 알림, 화면 구성, 환경 분리, 테스트·출시 절차를 확정한다
>
> **Project**: reading-log-mobile
> **Version**: 0.1.0 (1차 출시 목표 1.0.0)
> **Author**: Mincoln Cho
> **Date**: 2026-09-25
> **Status**: Draft
> **Planning Doc**: [reading-log-mobile.plan.md](../../01-plan/features/reading-log-mobile.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 독서기록이 PC 웹 전용이라 읽는 순간 기록하기 어렵고, 같은 습관을 가진 다른 사람도 쓸 수 있는 제품으로 확장 |
| **WHO** | 하루 목표 페이지로 여러 권(도서관 대출 포함)을 병행해서 읽는 일반 사용자, 1차는 한국어 |
| **RISK** | 스토어 심사(계정 삭제·Apple 로그인·공시), Play 비공개 테스트 의무, 서버 검증의 클라이언트 이전, 오프라인 쓰기 |
| **SUCCESS** | 두 스토어 공개 출시, 웹 핵심 흐름 동일 동작, 사용자 간 데이터 완전 분리 |
| **SCOPE** | Flutter 앱(`mobile/`), Firebase Auth/Firestore/Crashlytics/Analytics, 로컬 알림, 스토어 출시 준비 |

---

## 0. Plan 결정 반영

| 항목 | 결정 |
|------|------|
| 형상관리 | **이 저장소 안 `mobile/` 디렉토리** (2026-09-25 사용자 결정 — Plan §6.2의 "별도 리포 권장"을 대체). 웹과 코드는 공유하지 않고 문서·이력만 함께 관리 |
| 패키지/번들 ID | **`com.codenyang.readinglog`** (iOS·Android 동일). 요청한 `reading-log`의 하이픈은 Android applicationId에 쓸 수 없어 사용자 확인 후 확정. Dart 패키지명 `readinglog` |
| 개발용 ID | `com.codenyang.readinglog.dev` (dev 환경, §10.2) — 운영 앱과 한 기기에 함께 설치 가능 |

Plan §9 Open Questions 중 설계에 필요한 것은 아래 기본안으로 진행하고, 값은 모두 사용자 설정 또는 확인 대상으로 둔다.

| # | 질문 | 설계 기본안 | 상태 |
|---|------|-------------|------|
| 1 | 앱 이름·브랜딩 | 가칭 "독서기록" — 표시명은 ARB/네이티브 설정 한 곳에서 바꿀 수 있게 | 사용자 확인 필요 |
| 2 | 개발자 계정 유형 | 일정은 개인 계정(비공개 테스트 필요) 기준으로 잡음 | 사용자 확인 필요 |
| 3 | 이메일 로그인 | 1.0.0 미제공 (Apple·Google만) | 사용자 확인 필요 |
| 4 | 리마인더 기본값 | 기본 꺼짐, 첫 책 등록 후 켜기를 한 번 제안 | 기본안 |
| 5 | 잔디 기간 | 사용자 설정(설정 화면에서 선택), 초기값만 둠 | 기본안 |
| 6 | 분석 이벤트 | §9.3의 최소 이벤트, 책 제목 등 사용자 콘텐츠는 보내지 않음 | 기본안 |

---

## 1. Overview

### 1.1 Design Goals

- 웹 독서기록과 **같은 입력에 같은 결과** — 계산·검증 규칙을 순수 Dart로 옮기고 웹 테스트 시나리오를 그대로 테스트한다.
- **오프라인에서도 체크가 된다** — 기록 저장이 트랜잭션 없이 문서 1건 쓰기로 끝나는 데이터 구조.
- **사용자 데이터 완전 분리** — 모든 데이터를 `users/{uid}` 아래에 두고 보안 규칙으로 본인만 접근.
- **도메인 값은 상수로 두지 않는다** — 하루 목표·반납일·리마인더 시간·잔디 기간은 사용자 입력/설정, 코드에는 초기값만.

### 1.2 Design Principles

- 계층: `domain`(순수 Dart, Flutter/Firebase 의존 없음) ← `data`(Firestore) ← `features`(UI + Riverpod). 도메인은 단위 테스트만으로 검증 가능해야 한다.
- 날짜는 기기 로컬 기준 `YYYY-MM-DD` 문자열. `DateTime.toUtc()`·ISO 문자열 자르기 금지 (웹과 동일 원칙).
- 서버 코드 없음(1.0.0). Cloud Functions가 필요해지면 그때 추가한다.

---

## 2. Architecture

### 2.1 Component Diagram

```
┌──────────────────────────── Flutter app (mobile/) ────────────────────────────┐
│ features/ (UI, Riverpod)                                                      │
│  auth · today · books · heatmap · settings                                    │
│        │ watch/read providers                                                 │
│ data/                           domain/ (pure Dart)                           │
│  BookRepository ──────────────▶ Book, ReadingCalc, LogValidator, DateKey      │
│  UserSettingsRepository                                                       │
│  ReminderService (local notif)                                                │
└────────┬──────────────────────────────────────────────────────────────────────┘
         │ cloud_firestore (offline cache) / firebase_auth
         ▼
   Firebase (prod / dev 프로젝트)
   Auth · Firestore(users/{uid}/…) · Crashlytics · Analytics
```

### 2.2 Data Flow

```
앱 시작 → Auth 상태 구독 → 로그인됨 → users/{uid}/books 스냅샷 구독(캐시 우선)
→ domain 계산(현재 페이지·예상일·잔디 합계) → 화면
체크 → LogValidator(로컬 캐시 기준) 통과 → 책 문서 1건 update(logs.{date}, finished_at) → 캐시 즉시 반영 → 온라인 시 동기화
```

### 2.3 Dependencies (pub 패키지, 버전은 구현 시점 최신 안정판)

| 패키지 | 용도 |
|--------|------|
| `firebase_core`, `firebase_auth`, `cloud_firestore` | 인증, 데이터 |
| `firebase_crashlytics`, `firebase_analytics` | 크래시, 이벤트 |
| `google_sign_in` | Google 로그인 |
| `flutter_riverpod` | 상태 관리 |
| `go_router` | 라우팅, 알림 탭 딥링크 |
| `flutter_local_notifications`, `timezone`, `flutter_timezone` | 로컬 예약 알림 |
| `shared_preferences` | 기기별 설정(리마인더) |
| `intl`, `flutter_localizations` | 날짜 표시, ARB 문자열 |
| `url_launcher` | 약관·방침·문의 링크 |
| `package_info_plus` | 앱 버전 표시 |
| dev: `flutter_lints`, `mocktail` | 정적 분석, 목 |

Apple 로그인은 `firebase_auth`의 `AppleAuthProvider` + `signInWithProvider`를 사용한다(별도 패키지 없이 iOS 네이티브, Android 웹 플로우).

---

## 3. Data Model

### 3.1 Firestore 구조

```
users/{uid}                              # 사용자 문서
  created_at: Timestamp
  default_daily_target: int              # 새 책 폼의 하루 목표 초기값 (사용자 설정, 최초 10)
  heatmap_weeks: int                     # 잔디 표시 주 수 (사용자 설정)

users/{uid}/books/{bookId}               # bookId = Firestore 자동 ID
  title: string
  total_pages: int                       # ≥ 1
  start_page: int                        # 0 ≤ start_page ≤ total_pages
  start_date: string 'YYYY-MM-DD'
  daily_target: int                      # ≥ 1
  due_date: string 'YYYY-MM-DD' | null   # ≥ start_date
  logs: map<'YYYY-MM-DD', int>           # 날짜 → 그날 도달한 페이지 (page_to)
  finished_at: string 'YYYY-MM-DD' | null
  created_at: Timestamp
  updated_at: Timestamp
```

필드명은 웹과 같은 snake_case를 유지한다(규칙 이식·비교가 쉬움).

### 3.2 핵심 결정: 기록(logs)을 책 문서 안의 map으로

| 대안 | 오프라인 쓰기 | 정합성 | 비고 |
|------|:---:|:---:|------|
| 웹처럼 별도 logs 컬렉션 + 트랜잭션 | ✗ (트랜잭션은 온라인 필요) | 트랜잭션으로 보장 | Plan §5 리스크 그대로 |
| 별도 logs 컬렉션 + batch | ○ | 책 문서와 기록 문서가 따로 어긋날 수 있음 | finished_at 불일치 가능 |
| **책 문서 안 `logs` map (채택)** | ○ | 기록과 finished_at이 **한 문서 한 번의 쓰기**로 함께 바뀜 | 문서 크기: 하루 1항목 ≈ 수십 바이트 → 수년 기록도 1MiB 한도와 거리가 멂 |

- 체크: `update({'logs.2026-09-25': 52, 'finished_at': …, 'updated_at': serverTimestamp})`
- 체크 해제: `update({'logs.2026-09-25': FieldValue.delete(), 'finished_at': …})`
- 필드 경로 단위 업데이트라 두 기기에서 다른 날짜를 동시에 체크해도 서로 덮어쓰지 않는다. 같은 날짜를 동시에 바꾸면 나중 쓰기가 이긴다(개인 데이터라 허용).
- 잔디·목록은 `users/{uid}/books` 한 번의 구독으로 모두 계산 → 읽기 비용 최소.

### 3.3 기기별 설정 (shared_preferences, 동기화 안 함)

| 키 | 값 | 이유 |
|----|----|------|
| `reminder_enabled` | bool | 알림은 기기마다 켜고 끄는 게 자연스러움 |
| `reminder_time` | 'HH:mm' | 사용자 선택 |
| `reminder_prompted` | bool | 첫 책 등록 후 켜기 제안을 한 번만 |

---

## 4. Domain Logic (웹 이식)

원본: `client/src/utils/readingCalc.js`, `server/routes/reading.js`. 위치: `mobile/lib/domain/`.

### 4.1 모델

```dart
class Book {
  final String id, title;
  final int totalPages, startPage, dailyTarget;
  final DateKey startDate;               // 'YYYY-MM-DD' 값 객체, 비교 연산 제공
  final DateKey? dueDate, finishedAt;
  final SplayTreeMap<DateKey, int> logs; // 날짜 오름차순
}
```

`DateKey`: 로컬 날짜 값 객체 (`today()`, `addDays(n)`, `daysUntil(other)`, `compareTo`) — 문자열 파싱은 `DateTime(y, m, d)`로만.

### 4.2 계산 (`ReadingCalc`) — 웹 §3.3과 1:1

| 함수 | 규칙 |
|------|------|
| `currentPage(book)` | 마지막 기록의 page_to, 없으면 startPage |
| `pageBefore(book, date)` | date 이전 마지막 기록, 없으면 startPage |
| `pagesOn(book, date)` | 그날 기록 − pageBefore |
| `status(book, today)` | finishedAt 있으면 done / startDate > today면 planned / 그 외 reading |
| `daysLeft(total, current, target)` | ceil((total − current) / target), 최소 0 |
| `estimateFinish(...)` | 기준일 + daysLeft − 1 (기준일: planned면 startDate, 오늘 기록 있으면 내일, 아니면 오늘), 남은 일수 0이면 null |
| `targetForDueDate(...)` | ceil(남은 페이지 / (from ~ dueDate 일수)), from = 오늘(오늘 기록 있으면 내일, planned면 startDate), 지났으면 null |
| `missedDays(book, today)` | startDate ~ 어제(완독일 이전) 중 기록 없는 날 수 |
| `isOverdue(book, today)` | dueDate != null && eta > dueDate |
| `dailyTotals(books)` | Map<DateKey, {pages, items:[{bookId, title, pages, target}]}> |
| `streak(totals, today)` | 오늘 기록 없으면 어제부터 연속 일수 |
| `computeFinishedAt(book)` | logs 오름차순에서 page_to ≥ total인 첫 날짜, 없으면 startPage ≥ total ? startDate : null |

### 4.3 검증 (`LogValidator`, `BookValidator`) — 웹 서버 규칙 이식

결과는 `sealed class ValidationError`로 반환하고 UI에서 ARB 메시지로 매핑한다.

| 대상 | 규칙 | 에러 |
|------|------|------|
| 기록 날짜 | startDate ≤ date ≤ today | `outOfRangeDate` |
| 기록 페이지 | pageBefore(date) < page ≤ totalPages | `notAfterPrevious(prev)` / `overTotal` |
| 기록 페이지 | 이후 기록이 있으면 page ≤ 그 기록 | `overNext(next)` |
| 책 제목 | trim 후 비어 있지 않음 | `titleRequired` |
| 총 페이지 | 정수 ≥ 1 | `invalidTotal` |
| 현재 페이지 | 0 ≤ startPage ≤ total | `invalidStartPage` |
| 하루 목표 | 정수 ≥ 1 | `invalidTarget` |
| 반납일 | null 또는 ≥ startDate | `dueBeforeStart` |
| 수정 시 | startPage ≤ 첫 기록, total ≥ 마지막 기록, startDate ≤ 첫 기록 날짜 | `startAfterLogs` / `totalBelowLogs` / `startDateAfterLogs` |

검증은 로컬 캐시 스냅샷 기준으로 수행한다(오프라인에서도 동작). 여러 기기 동시 수정으로 드물게 순서가 어긋날 수 있으나, 파생값은 항상 기록에서 다시 계산하므로 화면이 깨지지 않는다.

### 4.4 오늘(today) 갱신

- `todayProvider`: 현재 로컬 날짜. `AppLifecycleState.resumed` 시 재계산 + 다음 자정까지 `Timer` 1회 예약 후 재계산.
- 선택 날짜가 "어제"이던 중에 자정이 지나면 새 오늘로 이동(웹과 동일), 그 외 과거 날짜는 유지.

---

## 5. Security Rules (`mobile/firebase/firestore.rules`)

> 2026-09-25 구현: 아래 초안에 더해 허용 필드 화이트리스트(`keys().hasOnly`), 필수 필드(`hasAll`), 제목 길이 기술 한도를 넣었다. 에뮬레이터 테스트 21건 통과(`mobile/firebase/rules-test`).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isOwner(uid) { return request.auth != null && request.auth.uid == uid; }
    function isDateKey(v) { return v is string && v.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$'); }

    match /users/{uid} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid)
        && request.resource.data.default_daily_target is int
        && request.resource.data.default_daily_target >= 1
        && request.resource.data.heatmap_weeks is int
        && request.resource.data.heatmap_weeks >= 1;

      match /books/{bookId} {
        function validBook(d) {
          return d.title is string && d.title.size() > 0
            && d.total_pages is int && d.total_pages >= 1
            && d.start_page is int && d.start_page >= 0 && d.start_page <= d.total_pages
            && d.daily_target is int && d.daily_target >= 1
            && isDateKey(d.start_date)
            && (d.due_date == null || (isDateKey(d.due_date) && d.due_date >= d.start_date))
            && (d.finished_at == null || isDateKey(d.finished_at))
            && d.logs is map;
        }
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid) && validBook(request.resource.data);
      }
    }
  }
}
```

- 보안 규칙은 **소유자·형식·범위**만 보장한다. logs 값의 단조 증가처럼 map 전체를 도는 검증은 규칙으로 하지 않고 도메인 계층이 담당한다(규칙은 반복문을 지원하지 않음).
- 문자열 길이 상한 등 남용 방지 한도는 규칙 테스트 작성 시 함께 정한다(도메인 값이 아닌 기술적 한도).
- 규칙은 에뮬레이터 테스트(§11.2)를 통과해야 배포한다.

---

## 6. Auth & Account

### 6.1 로그인

| 플랫폼 | 제공 |
|--------|------|
| iOS | Apple 로그인, Google 로그인 |
| Android | Google 로그인, Apple 로그인(웹 플로우) — 기기를 바꿔도 같은 계정으로 들어올 수 있게 |

- 첫 로그인 시 `users/{uid}` 문서를 초기값으로 생성(`default_daily_target`, `heatmap_weeks`).
- 로그인 전에는 온보딩 → 로그인 화면만 접근 가능(`go_router` redirect).

### 6.2 계정 삭제 (설정 → 계정 삭제)

```
확인 다이얼로그(되돌릴 수 없음 안내, 예/아니오)
→ 재인증 (로그인한 제공자로 다시 로그인)   ← Auth 삭제가 실패해 데이터만 지워지는 상황 방지
→ Apple 계정이면 revokeTokenWithAuthorizationCode (Apple 요구사항: 토큰 폐기)
→ users/{uid}/books 전체 삭제 (batch, 문서 수 한도 단위로 나눠서)
→ users/{uid} 삭제
→ FirebaseAuth.currentUser.delete()
→ 로컬 설정·알림 전부 제거 → 온보딩으로
```

- 중간 실패 시 에러를 보여주고 다시 시도할 수 있게 한다(삭제는 멱등).
- Google Play용 **웹 계정 삭제 안내 URL**: 앱 설치 없이도 삭제를 요청할 수 있는 정적 페이지(앱 내 삭제 방법 + 문의 이메일로 요청) — §12 출시 준비물.

---

## 7. Reminder (로컬 알림)

- 설정에서 켜기/끄기 + 시간 선택. 켤 때 OS 알림 권한 요청(Android 13+ `POST_NOTIFICATIONS`, iOS 권한), 거부 시 설정 앱으로 안내.
- **예약 방식**: 반복 알림 대신 "다음 며칠치"를 1회성 알림으로 예약하고, 앱을 열 때·체크할 때마다 다시 계산한다.
  - 오늘 읽는 중인 책을 모두 체크했거나 알림 시각이 지났으면 오늘 알림은 빼고 내일부터 예약 (FR-17).
  - 예약 기간(며칠치)은 기술 상수로 두고 코드 한 곳에 이름 붙여 둔다(OS 예약 개수 제한 대응용 — 도메인 값 아님).
- 알림 탭 → `/today` 딥링크.
- 알림 문구에 책 제목은 넣지 않는다(잠금화면 노출 고려) — "오늘 읽은 페이지를 기록해 보세요".

---

## 8. UI/UX Design

### 8.1 Navigation

```
/onboarding → /login
/(shell: 하단 탭)
   ├─ /today        오늘의 독서 (기본)
   ├─ /books        책 목록
   └─ /heatmap      잔디
/books/new, /books/:id/edit   책 폼 (전체 화면)
/settings                      설정 (각 탭 상단 톱니)
```

### 8.2 Screens

**오늘의 독서 (`/today`)**
```
┌──────────────────────────────┐
│ ◀  9월 25일 (목) ▼  ▶   ⚙    │  ← 날짜 탭하면 달력, 미래 불가, "오늘" 칩
│ ⟳ 동기화 대기 1건             │  ← hasPendingWrites일 때만
├──────────────────────────────┤
│ ☐ 사피엔스          52/636p   │
│   52 → [ 62 ] (+10)  [체크] [완독]│
│ ☑ 코스모스   120 → 135p (+15) │  ← 탭하면 페이지 수정
│   목표 미달 칩 / 완독 버튼     │
└──────────────────────────────┘
```
- 페이지 입력은 숫자 키패드, 기본값 = 이전 페이지 + 그 책의 하루 목표(총 페이지 상한).
- 체크박스 탭 = [체크]. 해제 = 그날 기록 삭제(되돌리기 스낵바 제공).
- [완독] → 다이얼로그 "‘{제목}’을(를) 완독 처리할까요? {날짜} 기록을 마지막 페이지({총}p)로 저장합니다." 예/아니오.
- 빈 상태: "이 날짜에 읽는 중인 책이 없어요" + [책 추가].

**책 목록 (`/books`)**: 남은 책(읽는 중 → 예정), 완독(접기). 카드: 제목, 진행 바, `현재/총 (%)`, 하루 Np · N일 남음 · 예상 MM-DD, 놓친 날, 반납 D-day(초과 예상 시 경고 색). FAB [책 추가].

**책 폼 (`/books/new`, `/books/:id/edit`)**: 제목, 시작일, 현재 페이지, 총 페이지, 하루 목표(초기값 = 사용자 설정), 반납일(선택) + [반납일 맞추기 (Np)] (계산 불가 시 비활성 + 사유), 하단 미리보기 "하루 Np 기준 약 N일 · 예상 완독 YYYY-MM-DD". 수정 화면에 [삭제](확인 다이얼로그).

**잔디 (`/heatmap`)**: 요약 3개(총 읽은 날·이번 달·연속일), 주 × 요일 그리드(설정한 주 수, 가로 스크롤, 최신이 오른쪽으로 시작), 칸 탭 → 바텀시트(날짜·책별 페이지·목표 미달) + [이 날짜 기록하기] → `/today?date=`. 색 단계 범례.

**설정 (`/settings`)**: 독서 리마인더(켜기, 시간), 새 책 기본 하루 목표, 잔디 표시 기간, 계정(로그인 정보, 로그아웃, 계정 삭제), 개인정보처리방침·이용약관·문의, 앱 버전.

### 8.3 Heatmap 색 단계

웹과 같은 "그날 전체 페이지 합" 기준 5단계. 경계값은 웹 값을 초기값으로 코드 한 곳에 두되, 테마 토큰으로 색을 정의해 다크 모드 대응. 색만으로 구분하지 않도록 칸 시맨틱 라벨 "9월 25일, 22페이지".

### 8.4 Theming & Accessibility

- Material 3, `ColorScheme.fromSeed` 라이트/다크, 시스템 설정 따름.
- 텍스트 스케일 1.0~2.0에서 레이아웃 확인, 터치 영역 최소 48dp, 모든 아이콘 버튼에 툴팁/시맨틱 라벨.

---

## 9. Error Handling & Observability

### 9.1 Errors

| 종류 | 처리 |
|------|------|
| 도메인 검증 실패 | 입력란 아래 에러 문구(ARB), 저장 안 함 |
| Firestore 권한 오류 | "다시 로그인해 주세요" → 로그인 화면 |
| 네트워크 없음 | 쓰기는 캐시에 반영 후 동기화 대기 표시, 로그인/계정 삭제만 온라인 필요 안내 |
| 알 수 없는 오류 | 스낵바 + Crashlytics non-fatal 기록 |

### 9.2 Crashlytics

`FlutterError.onError`, `PlatformDispatcher.instance.onError` 연결. 사용자 식별자는 uid 해시만(이메일·책 제목 전송 금지).

### 9.3 Analytics 이벤트 (최소)

| 이벤트 | 파라미터 |
|--------|----------|
| `book_added` | has_due_date(bool) |
| `log_checked` | is_backfill(bool), met_target(bool) |
| `book_finished` | via_finish_button(bool) |
| `reminder_toggled` | enabled(bool) |
| `due_date_fit_used` | — |

사용자 콘텐츠(책 제목·페이지 수)는 보내지 않는다. 스토어 공시 항목과 일치시킨다.

---

## 10. Project Structure & Environments

### 10.1 File Structure

```
mobile/
├── lib/
│   ├── main.dart / main_dev.dart     # 환경별 진입점 (Firebase options 선택)
│   ├── app/                          # App, router, theme
│   ├── core/                         # DateKey, 공통 위젯, 에러 매핑
│   ├── domain/                       # book.dart, reading_calc.dart, validators.dart
│   ├── data/                         # book_repository.dart, user_settings_repository.dart
│   ├── services/                     # reminder_service.dart, analytics.dart
│   ├── features/{auth,today,books,heatmap,settings}/
│   └── l10n/app_ko.arb
├── test/domain/                      # 웹 시나리오 이식 테스트
├── test/features/                    # 위젯 테스트
├── firebase.json                     # flutterfire 설정 + Firestore 규칙/에뮬레이터 설정 (flutterfire가 생성한 파일을 함께 사용)
├── firebase/
│   ├── firestore.rules, firestore.indexes.json
│   └── rules-test/                   # 에뮬레이터 규칙 테스트 (node --test)
└── android/, ios/
```

루트의 `firebase.json`·`firestore.rules`는 **웹 앱용**이며 모바일과 섞지 않는다.

### 10.2 Environments

| 환경 | Firebase 프로젝트 | 앱 ID | 표시명 |
|------|-------------------|-------|--------|
| dev | 신규 dev 프로젝트 | `com.codenyang.readinglog.dev` | "독서기록 dev" |
| prod | 신규 prod 프로젝트 | `com.codenyang.readinglog` | 확정된 앱 이름 |

- Android `productFlavors { dev, prod }`, iOS 스킴/빌드 구성 `Debug-dev`/`Release-prod` 등으로 번들 ID·설정 파일 분리.
- 실행: `flutter run --flavor dev -t lib/main_dev.dart`, 출시: `flutter build appbundle --flavor prod`, `flutter build ipa --flavor prod`.

### 10.3 Firebase 설정 파일

- `flutterfire configure`로 환경별 `firebase_options_*.dart`, `google-services.json`, `GoogleService-Info.plist` 생성. 모두 `.gitignore`(mobile/.gitignore에 반영됨) — 새 환경 세팅 방법은 `mobile/README.md`에 문서화.
- 릴리스 서명 키·`key.properties`는 커밋 금지(android/.gitignore 기본 포함).

---

## 11. Test Plan

### 11.1 Domain 단위 테스트 (웹 Design §8 + 추가 시나리오 이식)

| # | 시나리오 | 기대 |
|---|----------|------|
| 1 | 300p/현재 120p/목표 10 | 18일, 예상 = 오늘+17 |
| 2 | 오늘 150p 체크 | 15일, 예상 = 내일+14 |
| 3 | 소급: 어제 125, 오늘 130 | 어제 +5, 오늘 +5 |
| 4 | 어제 기록을 오늘보다 크게 | `overNext` |
| 5 | 총 페이지 도달 | finishedAt = 그 날짜 |
| 6 | 시작일 미래 | planned, 예상 = 시작일 기준 |
| 7 | 반납일 맞추기 420p·21일 남음 | 20p/일, 오늘 읽었으면 내일부터 |
| 8 | 반납일 지남 | targetForDueDate = null |
| 9 | 월/연 경계 addDays | 2026-12-31 +1 = 2027-01-01 |
| 10 | 놓친 날 | 시작 9/20, 기록 9/23·9/24, 오늘 9/24 → 3 |

### 11.2 Security Rules 테스트 (에뮬레이터)

- 타 사용자 문서 읽기/쓰기 거부, 비로그인 거부
- 잘못된 타입·범위(total 0, start > total, due < start) 거부
- 정상 생성/수정/삭제 허용

### 11.3 Widget / 수동 테스트

- 오늘의 독서: 체크·해제·수정·완독 다이얼로그 예/아니오
- 오프라인(비행기 모드)에서 체크 → 복귀 후 동기화
- 자정 경과, 백그라운드 복귀 시 날짜 갱신
- 리마인더: 권한 거부/허용, 모두 체크한 날 알림 없음
- 계정 삭제 후 재로그인 시 데이터 없음
- 다크 모드, 글꼴 200%, VoiceOver/TalkBack

---

## 12. Release Checklist

| 항목 | App Store | Google Play |
|------|:---:|:---:|
| 개발자 계정 | Apple Developer Program | Play Console (계정 유형 확인 — 개인이면 비공개 테스트 조건 확인) |
| 앱 ID 등록 | `com.codenyang.readinglog` + Sign in with Apple capability | `com.codenyang.readinglog`, Play App Signing |
| 개인정보처리방침 URL | 필수 | 필수 |
| 계정 삭제 | 앱 내 삭제 | 앱 내 삭제 + 웹 삭제 안내 URL |
| 개인정보 공시 | App Privacy (연락처(이메일), 식별자, 사용자 콘텐츠, 진단, 사용 데이터) | Data safety 동일 항목 |
| 연령 등급 | 설문 | 콘텐츠 등급 설문 |
| 테스트 | TestFlight (내부/외부) | 비공개 테스트 트랙 → 프로덕션 |
| 심사 메모 | 로그인 방법 안내(Apple/Google 로그인 사용) | — |
| 스토어 자산 | 아이콘, 스크린샷(필수 기기 크기), 설명·키워드(한국어) | 아이콘, 피처 그래픽, 스크린샷, 설명 |

---

## 13. Implementation Guide

### 13.1 Implementation Order (Plan §8 마일스톤과 대응)

1. [x] `mobile/` Flutter 프로젝트 생성 (`com.codenyang.readinglog`, iOS·Android) — 2026-09-25
2. [~] M0: `flutterfire configure` 완료(프로젝트 `readinglog-efa02`, 2026-09-25), `mobile/README.md` 세팅 문서 — dev/prod 분리·flavor는 사용자 결정 대기
3. [x] M1: `domain/` (DateKey, Book, ReadingCalc, Validators) + §11.1 테스트 — 2026-09-25, 28개 통과
4. [x] M1: `firebase/firestore.rules` + §11.2 규칙 테스트 — 2026-09-25, 21건 통과
5. [ ] M2: `data/` 리포지토리, Auth(Apple/Google), 라우터·셸
6. [ ] M2: 오늘의 독서 → 책 목록/폼 → 잔디
7. [ ] M3: 설정, 리마인더, 계정 삭제, 오프라인 표시, 다크 모드·접근성, Crashlytics/Analytics
8. [ ] M4: TestFlight/Play 비공개 테스트, 피드백 반영
9. [ ] M5: 스토어 등록·심사·출시

### 13.2 Conventions

| 항목 | 규칙 |
|------|------|
| 분석 | `flutter_lints` + `analysis_options.yaml`, `flutter analyze` 경고 0 |
| 네이밍 | 파일 snake_case, 클래스 PascalCase, Firestore 필드 snake_case |
| 문자열 | UI 문자열은 전부 `app_ko.arb` |
| 상수 | 도메인 값은 사용자 입력/설정. 코드 상수는 초기값·기술적 한도만, 이름과 이유 주석 필수 |
| 버전 | `pubspec.yaml` `version: x.y.z+build`, 스토어 제출마다 build 증가 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-25 | Initial draft — `mobile/` 프로젝트 생성, 패키지 `com.codenyang.readinglog` 확정 | Mincoln Cho |
