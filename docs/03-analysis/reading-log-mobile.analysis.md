---
template: analysis
version: 1.0
---

# reading-log-mobile Gap Analysis (Check)

> **Date**: 2026-09-29
> **Design**: [reading-log-mobile.design.md](../02-design/features/reading-log-mobile.design.md) · **Plan**: [reading-log-mobile.plan.md](../01-plan/features/reading-log-mobile.plan.md)
> **Implementation**: `mobile/` (branch `feature/reading-log-mobile`)
> **Method**: gap-detector 정적 대조 (빌드·실행 없음). 테스트 현황: Dart 38건, 보안 규칙 에뮬레이터 22건 통과(구현 단계에서 확인)

---

## 1. Match Rate

설계 §2~§13을 55개 항목으로 나눠 Implemented=1, Partial/Deviated=0.5, Missing=0으로 채점. 사용자 요청 변경(독서 중단, 완독일 미달 제외, iOS 15)은 설계 변경으로 반영, dev/prod 분리는 사용자 결정으로 보류(전체 범위에만 포함).

| 범위 | 항목 | 구현 | 부분/이탈 | 누락 | **일치율** |
|---|---|---|---|---|---|
| 1.0.0 전체 설계 범위 | 55 | 33 | 12 | 10 | **71%** |
| 지금까지 끝났어야 할 M0~M2 | 37 | 29 | 7 | 1 | **88%** |

FR 기준: Must 96% (12.5/13), 전체 FR 80% (16/20 — FR-16·17은 M3 예정, FR-20은 Could).

**판정**: M0~M2가 90%에 조금 못 미침. 원인은 Apple 로그인 entitlement 누락, 위젯 테스트 부재, 소수의 부분 구현. 전체 71%는 M3 미착수에 따른 예상 수치.

---

## 2. 주요 구현 현황 (요약)

| 영역 | 상태 | 근거 |
|---|---|---|
| 도메인(DateKey·Book·ReadingCalc·Validators, 중단 포함) | 구현 | `lib/domain/*` — 웹과 검증 순서 일치 |
| Firestore 구조·logs map 필드 경로 업데이트 | 구현 | `data/book_repository.dart:85-102` |
| 보안 규칙 + 에뮬레이터 테스트 | 구현(설계보다 엄격) | `firebase/firestore.rules`, `rules-test/` |
| 오늘 갱신(자정·복귀) | 구현 | `app/providers.dart:50-107` |
| 로그인 | **부분** | iOS Apple 로그인 entitlement 없음 |
| 오늘/책/폼/잔디/설정 화면 | 구현 | `features/*` |
| 계정 삭제 | 이탈(순서·로컬 정리) | `data/account_deletion.dart:18-26` |
| 약관·문의·버전 링크 | 구현 | `app/app_links.dart`, `settings_screen.dart` |
| 온보딩·리마인더·Crashlytics·Analytics·SPM | 누락 (M3 예정) | — |
| 위젯 테스트 | 누락 | `test/features/` 없음 |

전체 항목표는 gap-detector 보고(2026-09-29) 기준으로 아래 §3 갭 목록에 반영.

---

## 3. Gap List (심각도 순)

### 3.1 M0~M2 범위 — 지금 고쳐야 할 것

| # | 갭 | 위치 | 조치 |
|---|---|---|---|
| G1 | **Sign in with Apple entitlement 없음** — 실기기에서 Apple 로그인·계정 삭제 전 재인증 실패 | `ios/Runner/` (entitlements 파일·`CODE_SIGN_ENTITLEMENTS` 없음) | Xcode Capability 추가 후 `Runner.entitlements` 커밋 |
| G2 | **저장된 `finished_at`을 그대로 신뢰** — 두 기기 동시 수정 시 완독 상태와 기록이 어긋날 수 있음 (설계 §4.3 "파생값은 기록에서 계산"과 불일치) | `data/book_mapper.dart:24` | 읽을 때 `ReadingCalc.computeFinishedAt`으로 다시 계산 |
| G3 | **수정 폼이 추가로 바뀜** — 수정 중 책이 삭제되면 저장 시 `addBook`으로 중복 생성, 없는 id는 로딩 무한 | `features/books/book_form_screen.dart:57,102-110,152` | `bookId`가 있으면 추가로 넘어가지 않게, 없는 책이면 목록으로 복귀 |
| G4 | **계정 삭제 재인증 우회** — Apple/Google 외 제공자면 재인증 없이 데이터부터 지움 | `data/auth_repository.dart:40-47` | 알 수 없는 제공자면 예외 |
| G5 | **설정 값 상한 없음** — 잔디 주 수를 크게 넣으면 `weeks × 7` 칸을 한 번에 그림 | `settings_screen.dart:45`, `firestore.rules:24-25`, `heatmap_screen.dart:93-113` | 이름 붙인 기술적 상한을 앱·규칙에 추가 |
| G6 | **설정 저장이 `update()`** — 사용자 문서가 아직 없으면 실패, `ensureCreated`는 캐시 기준 get→set이라 설정을 덮어쓸 수 있음 | `data/user_settings_repository.dart:44-50` | `set(merge: true)`로 변경 |
| G7 | 되돌리기(undo)가 검증 없이 기록 | `features/today/checklist_tile.dart:84` | `LogValidator` 거치기 |
| G8 | 위젯 테스트 없음 | `test/features/` | 오늘 체크·해제·완독 다이얼로그 최소 테스트 |
| G9 | ARB 외 하드코딩 문자열 | `core/messages.dart:41,52-53`, `heatmap_screen.dart:197`, `checklist_tile.dart:133,154` | ARB로 이동 |
| G10 | "반납일 맞추기" 불가 시 버튼을 숨김(설계: 비활성+사유) | `book_form_screen.dart:288-305` | 비활성 버튼 + 사유 |
| G11 | 앱 표시 이름 불일치 (네이티브 "Readinglog" vs ARB "독서기록") | `Info.plist:10`, `AndroidManifest.xml:3` | 앱 이름 확정 후 한 곳에서 맞춤 (사용자 결정 대기) |
| G12 | 책 폼이 하단 탭 안에서 열림(설계: 전체 화면) | `app/router.dart:52-61` | 셸 밖 라우트로 이동 (경미) |

### 3.2 M3 — 예정된 남은 작업

| # | 항목 | 비고 |
|---|---|---|
| M3-1 | 온보딩 (`/onboarding`), 계정 삭제 후 온보딩으로 | Must |
| M3-2 | 리마인더 (FR-16·17): 기기 설정(shared_preferences), 권한, 며칠치 예약·재계산, 알림 탭 → `/today` | Should/Could, 패키지 추가만 됨 |
| M3-3 | 계정 삭제 시 로컬 설정·알림 정리 | 리마인더와 함께 |
| M3-4 | 오프라인 표시 보강 (대기 건수, 모든 탭), 로그인·삭제 시 온라인 필요 안내, 삭제 타임아웃 | Should |
| M3-5 | 오류 처리 §9.1: 권한 오류 → 재로그인, 원문 오류 대신 ARB 메시지 | Should |
| M3-6 | Crashlytics / Analytics (§9.2·9.3) | Should |
| M3-7 | 접근성: 잔디 칸 터치 영역, 글꼴 200%에서 페이지 입력 폭 | Should |
| M3-8 | Swift Package Manager 전환 (CocoaPods 배포 2026-10 이후 중단 예정) | 출시 전 |
| — | dev/prod 분리 | 사용자 결정으로 출시 직전 |

---

## 4. 확인된 정상 동작 (위험 없음)

- 오프라인 쓰기: UI의 모든 쓰기가 `reportWriteErrors`로 기다리지 않고 처리, 폼은 즉시 이동
- 규칙 ↔ mapper 필드 일치 (`stopped_at`, null 필드, 타임스탬프 모두 허용 목록에 있음)
- 날짜 처리: `toUtc()` 없음, 주 시작(일요일)·자정 이동 규칙 정상
- 검증 순서·중단일 규칙이 웹(`server/routes/reading.js`)과 일치

---

## 5. Next Steps

1. `/pdca iterate reading-log-mobile` — §3.1의 G1~G10 수정 (G11은 앱 이름 확정 후) → M0~M2 90% 이상 목표
2. 이어서 M3 진행 (온보딩 → 리마인더 → Crashlytics/Analytics → 접근성 → SPM)
3. M3 후 재분석

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-09-29 | 첫 분석 (전체 71%, M0~M2 88%) |
