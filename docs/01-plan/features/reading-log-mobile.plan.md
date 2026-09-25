---
template: plan
version: 1.3
---

# reading-log-mobile Planning Document

> **Summary**: 웹 앱(time_based_todolist)의 "독서기록" 기능만 떼어 Flutter 기반 iOS/Android 앱으로 App Store·Google Play에 공개 출시한다. 책 등록(시작일·현재 페이지·총 페이지·하루 목표·반납일) → 매일 도달 페이지 체크 → 남은 일수·완독 예상일 계산 → 잔디 히트맵 점검까지를 1차 출시 범위로 하고, 백엔드는 Firebase(Auth + Firestore)를 앱에서 직접 사용한다.
>
> **Project**: reading-log-mobile (신규 제품, time_based_todolist에서 분리)
> **Version**: 0.1.0 (1차 출시 목표 1.0.0)
> **Author**: Mincoln Cho
> **Date**: 2026-09-25
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | "하루 N페이지" 습관으로 여러 권을 동시에 읽는 사람은 책별 진행도·완독 예상일·반납일·매일 읽었는지를 한곳에서 관리할 도구가 없고, 지금 만든 독서기록은 PC 웹에서만 쓸 수 있어 책을 읽는 순간(주로 모바일) 바로 체크하기 어렵다 |
| **Solution** | 웹 독서기록의 도메인 규칙(도달 페이지만 기록 → 파생값 계산, 페이지 단조 증가 검증, 반납일 맞추기, 완독 확인)을 그대로 옮긴 Flutter 앱을 만들고, Firebase Auth + Firestore(사용자별 데이터 분리, 오프라인 캐시)로 서버 운영 없이 공개 출시한다 |
| **Function/UX Effect** | 책을 덮는 순간 폰에서 한 번 탭해 오늘 읽은 페이지를 체크하고, 설정한 시간에 오는 리마인더로 빼먹는 날을 줄이며, 잔디와 예상일로 꾸준함과 반납 일정을 한눈에 확인한다 |
| **Core Value** | 작은 독서 습관을 여러 권·도서관 반납 일정까지 포함해 "오늘 몇 페이지 읽으면 되는지"로 바꿔 주는 개인 독서 습관 앱 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 독서기록이 PC 웹 전용이라 읽는 순간 기록하기 어렵고, 같은 습관을 가진 다른 사람도 쓸 수 있는 제품으로 확장하고 싶음 |
| **WHO** | 하루 목표 페이지를 정해 여러 권을 병행해서 읽는 일반 사용자 (도서관 대출 책 포함) — 1차 타깃은 한국어 사용자 |
| **RISK** | 스토어 심사(계정 삭제·Apple 로그인·개인정보 공시), Google Play 신규 개인 계정의 비공개 테스트 의무, 서버 검증 로직을 클라이언트/보안 규칙으로 옮길 때의 정합성, 오프라인 쓰기 |
| **SUCCESS** | 두 스토어에 1.0.0 공개 출시, 웹 독서기록의 핵심 흐름(책 등록·체크·완독·반납일·잔디)이 모바일에서 동일하게 동작, 사용자 간 데이터가 완전히 분리됨 |
| **SCOPE** | (1) Flutter 앱 (2) Firebase Auth 로그인·계정 삭제 (3) Firestore 사용자별 데이터 + 보안 규칙 (4) 책/체크/완독/반납일/잔디/목록 화면 (5) 독서 리마인더 알림 (6) 스토어 출시 준비물(개인정보처리방침, 공시, 심사 대응) |

---

## 1. Overview

### 1.1 Purpose

웹 앱의 "독서기록" 기능을 독립 모바일 앱으로 분리해 일반 사용자에게 공개 출시한다. 1차 출시(1.0.0)는 **메모 없이 기록 중심**으로, 책 등록·매일 체크·완독·반납일 맞추기·잔디 히트맵·남은 책/완독 목록을 제공한다.

### 1.2 Background

- 웹 독서기록(`docs/01-plan/features/reading-log.plan.md`, `docs/02-design/features/reading-log.design.md`)은 2026-09-24 구현·머지되었고, 도메인 규칙은 검증된 상태다.
- 사용자 결정 사항 (2026-09-25):
  - **공개 출시** — App Store / Google Play 일반 사용자 대상. 회원가입·사용자별 데이터 분리·개인정보처리방침·앱 내 계정 삭제가 필수가 된다.
  - **Firebase 직접 연동** — Flutter 앱이 Firebase Auth + Cloud Firestore를 직접 사용하고, 사용자 분리는 Firestore 보안 규칙으로 보장한다. 별도 서버(Express)를 운영하지 않는다.
  - **웹 앱과 완전 분리** — 별도 제품. 웹의 Firestore 프로젝트·데이터와 연결하지 않는다.
  - **1차 출시는 메모 없이 기록만** — 독서 메모·AI 태그 추출은 이후 버전에서 검토한다.
- 웹에서 받은 피드백을 그대로 계승한다: 하루 목표·대출 기간 같은 **도메인 값은 상수로 고정하지 않고 사용자가 입력**한다(하루 목표는 책마다, 반납일은 날짜로 입력).

### 1.3 웹 독서기록에서 가져오는 것 / 바뀌는 것

| 구분 | 웹 (현재) | 모바일 (1.0.0) |
|------|-----------|----------------|
| 사용자 | 로컬 단일 사용자, 인증 없음 | 다중 사용자, Firebase Auth 로그인 필수 |
| 데이터 접근 | Express 서버가 firebase-admin으로 접근 | 앱이 Firestore SDK로 직접 접근, 보안 규칙으로 본인 데이터만 허용 |
| 검증 위치 | 서버 라우트(페이지 단조 증가, 범위, finished_at 재계산) | 앱의 도메인 계층 + Firestore 보안 규칙(형식·범위·소유자) — 세부 분담은 Design에서 확정 |
| 오프라인 | 없음(서버 필요) | Firestore 오프라인 캐시로 조회·체크 가능, 온라인 복귀 시 동기화 |
| 메모 | 데일리노트로 저장 + AI 태그 | 제외 (후속 버전) |
| 백업 | JSON 내보내기/가져오기 | 계정 기반 클라우드 저장 (내보내기는 Could) |
| 알림 | 없음 | 사용자가 정한 시간의 독서 리마인더(로컬 알림) |
| 날짜 이동 | 자정 경과 1분 체크 | 앱 포그라운드 복귀 시·자정 경과 시 "오늘" 갱신 |

### 1.4 Related Documents

- 웹 독서기록 Plan: `docs/01-plan/features/reading-log.plan.md`
- 웹 독서기록 Design (파생값 계산 규칙 §3.3, 검증 규칙 §4.2): `docs/02-design/features/reading-log.design.md`
- 웹 계산 로직 원본: `client/src/utils/readingCalc.js` (Dart로 이식 대상)
- 웹 검증 로직 원본: `server/routes/reading.js`

---

## 2. Scope

### 2.1 In Scope (1.0.0)

**계정**
- [ ] 로그인: Apple 로그인, Google 로그인 (iOS는 소셜 로그인 제공 시 Apple 로그인 필수 — App Store 심사 지침 4.8)
- [ ] 로그아웃, 앱 내 **계정 삭제**(Firestore 사용자 데이터 전체 + Auth 계정 삭제, 재인증 처리)
- [ ] 최초 실행 온보딩(앱 소개 1~3장 + 로그인)

**독서 기록 (웹 기능 이식)**
- [ ] 책 등록/수정/삭제: 제목, 시작일, 현재 페이지, 총 페이지, 하루 목표 페이지(기본값은 설정에서 변경 가능), 반납일(선택)
- [ ] "반납일 맞추기": 오늘(오늘 이미 읽었으면 내일, 예정 책은 시작일)부터 반납일까지 남은 날로 하루 목표 계산
- [ ] 오늘의 독서 체크리스트: 책마다 도달 페이지 입력(기본값 = 이전 페이지 + 하루 목표) → 체크, 체크 해제 = 그날 기록 삭제, 도달 페이지 수정
- [ ] 완독 버튼 + 확인 다이얼로그(예/아니오) → 그날 기록을 총 페이지로 저장
- [ ] 날짜 이동(과거 소급 기록, 미래 불가), 잔디 칸 탭 → 해당 날짜로 이동
- [ ] 파생값: 현재 페이지, 진행률, 남은 일수, 완독 예상일, 놓친 날, 목표 미달 표시, 반납일 D-day·반납일 초과 예상
- [ ] 잔디 히트맵(최근 기간, 가로 스크롤), 요약(총 읽은 날·이번 달·연속일)
- [ ] 목록: 남은 책(읽는 중 → 읽을 예정), 완독(접기)
- [ ] 페이지 단조 증가 검증(이전 기록 < 입력 ≤ 이후 기록·총 페이지), 시작일~오늘만 기록 가능

**앱 공통**
- [ ] 독서 리마인더: 사용자가 켜고 끄며 시간을 정하는 로컬 알림(오늘 전부 체크했으면 알리지 않음은 Should)
- [ ] 설정: 알림, 새 책의 기본 하루 목표, 계정(로그아웃·삭제), 개인정보처리방침/이용약관/문의 링크, 앱 버전
- [ ] 오프라인에서 조회·체크 가능, 동기화 상태 표시
- [ ] 다크 모드, 시스템 글꼴 크기 대응
- [ ] Crashlytics(크래시 수집), Analytics(핵심 이벤트) — 개인정보 공시에 반영

**출시 준비**
- [ ] 개인정보처리방침·이용약관 웹 페이지(호스팅 URL), 지원 연락처
- [ ] App Store Connect: 앱 개인정보 공시(Privacy Nutrition Label), 연령 등급, 심사용 안내
- [ ] Google Play Console: 데이터 보안 섹션, 콘텐츠 등급, 계정 삭제 안내 URL(웹에서 삭제 요청 경로)
- [ ] 앱 아이콘, 스플래시, 스토어 스크린샷·설명(한국어)
- [ ] 비공개 테스트: TestFlight, Google Play 비공개 테스트 트랙

### 2.2 Out of Scope (1.0.0)

- 독서 메모(마크다운)·AI 태그 추출 — 후속 버전 후보
- 웹 앱(time_based_todolist)과의 데이터 동기화·계정 연동
- 책 검색 API(ISBN·도서 DB)·표지 이미지·바코드 스캔
- 홈 화면 위젯, Apple Watch/Wear OS
- 소셜 기능(친구, 공유 피드, 랭킹), 독서 모임
- 유료화(구독·광고·인앱 결제) — 출시 후 별도 결정
- 다국어 — 1.0.0은 한국어만. 단, 문자열은 처음부터 ARB로 분리해 추후 추가 가능하게
- 태블릿 전용 레이아웃(기본 반응형만)
- 웹 백업 JSON 가져오기 — 수요 확인 후 Could로 재검토

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Apple·Google 계정으로 로그인하고, 로그인하지 않으면 기록 화면에 들어갈 수 없다 | Must | Pending |
| FR-02 | 설정에서 계정을 삭제하면 해당 사용자의 모든 Firestore 데이터와 Auth 계정이 삭제된다. 최근 로그인이 오래된 경우 재인증을 요청한다 | Must | Pending |
| FR-03 | 사용자 데이터는 사용자 ID 아래에만 저장되며, 보안 규칙으로 본인 외 읽기/쓰기가 불가능하다 | Must | Pending |
| FR-04 | 책은 제목·총 페이지(1 이상 정수)·현재 페이지(0 ≤ 현재 ≤ 총)·시작일·하루 목표(1 이상 정수)·반납일(선택, 시작일 이후)을 가진다 | Must | Pending |
| FR-05 | 새 책의 하루 목표 기본값은 설정에서 사용자가 바꿀 수 있다(초기값은 웹과 같은 10) | Should | Pending |
| FR-06 | 기록은 책 × 날짜당 1건이며 그날 도달한 페이지(`page_to`)만 저장한다. 현재 페이지·그날 읽은 양·완독 여부·예상일은 모두 기록에서 계산한다 | Must | Pending |
| FR-07 | 기록 저장 시 이전 기록(없으면 시작 페이지) < 입력 ≤ min(이후 기록, 총 페이지)이어야 하고, 날짜는 시작일 ≤ 날짜 ≤ 오늘이어야 한다. 위반 시 사유를 안내하고 저장하지 않는다 | Must | Pending |
| FR-08 | 기록 저장/삭제 시 완독일(`finished_at`)을 다시 계산한다(총 페이지에 처음 도달한 기록의 날짜) | Must | Pending |
| FR-09 | 남은 일수 = ceil((총 − 현재) ÷ 하루 목표), 예상일 = 기준일 + 남은 일수 − 1 (기준일: 예정 책은 시작일, 오늘 기록이 있으면 내일, 아니면 오늘) | Must | Pending |
| FR-10 | 반납일이 있으면 "반납일 맞추기"로 하루 목표를 계산해 채울 수 있고, 목록에 D-day와 "반납일 초과 예상"(예상일 > 반납일)을 표시한다. 반납일이 지났으면 계산 버튼을 비활성화하고 안내한다 | Must | Pending |
| FR-11 | 오늘의 독서 화면은 선택 날짜 기준 읽는 중인 책을 체크리스트로 보여주고, 체크·체크 해제·도달 페이지 수정·완독(확인 다이얼로그)을 제공한다 | Must | Pending |
| FR-12 | 그날 읽은 양이 그 책의 하루 목표보다 적으면 "목표 미달"로 표시한다 | Should | Pending |
| FR-13 | 잔디 히트맵은 날짜별 전체 책의 읽은 페이지 합으로 색 단계를 표시하고, 칸을 탭하면 그 날짜의 체크리스트로 이동한다. 요약(총 읽은 날·이번 달·연속일)을 함께 보여준다 | Must | Pending |
| FR-14 | 책 목록은 읽는 중(남은 일수 순) → 읽을 예정(시작일 순), 완독(완독일 역순, 접기)으로 나누고, 놓친 날 수를 표시한다 | Must | Pending |
| FR-15 | 오프라인에서도 조회·체크·수정이 가능하고, 온라인이 되면 자동 동기화된다. 동기화 대기 중임을 표시한다 | Should | Pending |
| FR-16 | 독서 리마인더를 켜고 알림 시간을 정할 수 있다. 권한이 거부되면 설정으로 안내한다 | Should | Pending |
| FR-17 | 리마인더 시각에 오늘 읽는 중인 책을 모두 체크했으면 알림을 보내지 않는다 | Could | Pending |
| FR-18 | 앱을 켜 둔 채 자정이 지나거나 백그라운드에서 돌아오면 "오늘"과 체크리스트가 새 날짜로 갱신된다 | Must | Pending |
| FR-19 | 설정에 개인정보처리방침·이용약관·문의 링크와 앱 버전을 표시한다 | Must | Pending |
| FR-20 | 내 데이터를 파일(JSON 또는 CSV)로 내보낼 수 있다 | Could | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 정합성 | 웹 `readingCalc.js`와 같은 입력에 같은 결과 — 웹 Design §8 테스트 시나리오를 Dart 단위 테스트로 이식해 전부 통과 | `flutter test` |
| 보안 | 보안 규칙으로 타 사용자 문서 접근 차단, 필드 타입·범위 검증 | Firebase 보안 규칙 에뮬레이터 테스트 |
| 개인정보 | 수집 항목 최소화(계정 식별자·이메일(제공 시)·독서 기록·크래시/이용 통계), 스토어 공시와 실제 수집 항목 일치 | 출시 전 체크리스트 대조 |
| 안정성 | 크래시 없는 사용자 비율 목표치를 Crashlytics로 추적 (목표값은 베타 결과로 확정) | Crashlytics |
| 성능 | 콜드 스타트 후 오늘의 독서 화면 표시까지 체감 지연 없음, 잔디 스크롤 끊김 없음 (목표값은 Design에서 기기 기준과 함께 확정) | 실기기 프로파일링 |
| 날짜 | 모든 날짜는 기기 로컬 기준 `YYYY-MM-DD` 문자열로 저장·계산, UTC 변환으로 인한 하루 밀림 없음 | 자정 전후·시간대 변경 테스트 |
| 접근성 | 시스템 글꼴 크기 확대 시 레이아웃 깨짐 없음, 스크린리더 라벨, 색만으로 정보 전달하지 않음(잔디 칸에 날짜·페이지 라벨) | 수동 테스트 (VoiceOver/TalkBack) |
| 호환성 | 지원 최소 OS 버전은 사용 패키지 요구사항과 사용자층을 보고 Design에서 확정 | 빌드·실기기 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done (1.0.0)

- [ ] App Store와 Google Play에 공개 출시 완료
- [ ] 웹 독서기록 핵심 흐름(책 등록 → 체크 → 소급 기록 → 완독 → 반납일 맞추기 → 잔디)이 모바일에서 동일하게 동작
- [ ] 계정 삭제 시 데이터가 실제로 모두 지워짐을 확인
- [ ] 보안 규칙 테스트로 타 사용자 데이터 접근이 막힘을 확인
- [ ] 비공개 테스트에서 발견된 치명 이슈 0건

### 4.2 Quality Criteria

- [ ] 도메인 계산 단위 테스트 통과 (웹 시나리오 이식 포함)
- [ ] 보안 규칙 에뮬레이터 테스트 통과
- [ ] `flutter analyze` 경고 0
- [ ] iOS/Android 실기기 각 1대 이상에서 전체 흐름 수동 테스트

### 4.3 출시 후 지표 (측정 항목 — 목표값은 베타 후 확정)

| 지표 | 정의 |
|------|------|
| 일간 체크율 | 읽는 중인 책이 있는 활성 사용자 중 그날 1건 이상 체크한 비율 |
| 7일 리텐션 | 가입 후 7일째에 앱을 연 사용자 비율 |
| 완독 수 | 사용자당 완독한 책 수 |
| 리마인더 사용률 | 리마인더를 켠 사용자 비율, 알림 → 체크 전환율 |
| 크래시 없는 사용자 비율 | Crashlytics 기준 |

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Google Play 신규 **개인** 개발자 계정은 프로덕션 출시 전 일정 인원·기간의 비공개 테스트가 의무 | High | High | 일정에 비공개 테스트 기간을 미리 반영, 테스터 모집을 개발 중에 시작. 조건은 신청 시점 Play Console 정책으로 확인 (조직 계정이면 해당 없음) |
| iOS 심사 반려: 계정 삭제 미제공, Apple 로그인 누락, 개인정보 공시 불일치 | High | Medium | 앱 내 계정 삭제·Apple 로그인을 Must로 포함, 공시 항목을 실제 SDK 수집 항목과 대조, 심사용 안내(로그인 방법) 작성 |
| 서버에서 하던 검증(페이지 단조 증가·finished_at)을 앱으로 옮기면서 조작/버그로 데이터가 어긋남 | Medium | Medium | 도메인 계층에 검증 집중 + 보안 규칙으로 형식·범위·소유자 검증. 여러 문서에 걸친 검증은 Design에서 방식 결정(트랜잭션/Cloud Functions/데이터 구조) |
| Firestore 트랜잭션은 오프라인에서 동작하지 않음 → 오프라인 체크 불가 | Medium | High | 오프라인에서도 되는 일괄 쓰기(batch) 구조로 설계하고, 검증은 로컬 캐시 기준으로 수행. Design에서 확정 |
| 날짜/시간대: 여행·시간대 변경 시 "오늘"이 바뀜 | Low | Low | 기기 로컬 날짜 기준으로 일관 처리, 저장은 날짜 문자열만 |
| Firebase 비용 증가(읽기 횟수) | Low | Medium | 사용자 데이터가 작아 한 번에 구독, 불필요한 재조회 방지. 예산 알림 설정 |
| 1인 개발로 스토어 운영(문의·리뷰 대응) 부담 | Medium | Medium | 지원 이메일 한 곳, FAQ 페이지, 크래시 알림으로 우선순위 판단 |
| 웹 코드와 로직이 이중 관리됨 | Low | Medium | 웹과 완전 분리 결정 — 모바일은 독립 제품으로 진화. 웹 규칙은 이식 시점 기준으로 복제 후 각자 관리 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration | Web/mobile apps with backend, MVPs | ☑ |
| **Enterprise** | Strict layer separation, microservices | High-traffic systems | ☐ |

모바일 앱 + BaaS(Firebase) 구성으로 Dynamic 수준. 앱 내부는 기능별 폴더 + 도메인 계층 분리.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected (제안) | Rationale |
|----------|---------|-----------------|-----------|
| 프레임워크 | Flutter / React Native | Flutter | 사용자 결정 |
| 백엔드 | Firebase 직접 / 기존 Express / 로컬 전용 | Firebase Auth + Cloud Firestore 직접 | 사용자 결정. 서버 운영 없음, 오프라인 캐시 내장 |
| Firebase 프로젝트 | 웹과 공유 / 신규 | 신규 프로젝트 (dev / prod 분리) | 웹과 완전 분리 결정, 공개 서비스와 개인 데이터 격리 |
| 데이터 구조 | 최상위 컬렉션 + uid 필드 / 사용자 하위 컬렉션 | `users/{uid}/books/{bookId}`, 기록은 책 하위 또는 사용자 하위 (Design에서 확정) | 보안 규칙이 단순(`request.auth.uid == uid`), 계정 삭제 시 하위 전체 삭제 |
| 상태 관리 | Riverpod / Bloc / Provider | Riverpod | Firestore 스트림 구독과 파생값 계산을 선언적으로 구성하기 쉬움 (Design에서 확정) |
| 라우팅 | go_router / Navigator | go_router | 딥링크(알림 탭 → 오늘의 독서) 대응 |
| 로컬 알림 | flutter_local_notifications 등 | 로컬 예약 알림 | 서버 푸시 없이 사용자 설정 시간 알림 |
| 도메인 계산 | 앱 / Cloud Functions | 앱 (순수 Dart 모듈) | 웹과 동일하게 파생값은 클라이언트 계산, 오프라인 동작 |
| 계정 삭제 | 앱에서 직접 / Cloud Function | Design에서 결정 (Auth 삭제 + 하위 데이터 재귀 삭제 보장 방식) | 대량 삭제·재인증 처리 |
| 크래시/통계 | Firebase Crashlytics + Analytics | 채택 | 같은 Firebase 생태계, 공시 항목 명확 |
| 저장소 | 이 리포 하위 폴더 / 별도 리포 | 별도 리포 권장 (문서는 이 리포 `docs/`에서 시작, Design 시점 이관 여부 결정) | 웹과 완전 분리된 독립 제품, 빌드·서명·CI가 별개 |

### 6.3 Folder Structure Preview (제안)

```
reading_log_mobile/
├── lib/
│   ├── app/                 # 앱 진입, 라우터, 테마
│   ├── core/                # 날짜 유틸(로컬 YYYY-MM-DD), 공통 위젯, 에러
│   ├── domain/              # 순수 Dart: Book/ReadingLog 모델, 계산(웹 readingCalc 이식), 검증 규칙
│   ├── data/                # Firestore 리포지토리, DTO 변환
│   ├── features/
│   │   ├── auth/            # 로그인, 온보딩, 계정 삭제
│   │   ├── today/           # 오늘의 독서 체크리스트, 완독 다이얼로그
│   │   ├── books/           # 책 등록/수정, 남은 책·완독 목록
│   │   ├── heatmap/         # 잔디, 요약
│   │   └── settings/        # 알림, 기본 하루 목표, 약관/문의
│   └── l10n/                # ARB 문자열 (1.0.0은 ko만)
├── test/                    # domain 단위 테스트 (웹 시나리오 이식)
├── firestore.rules          # 보안 규칙
└── firebase/                # 규칙 테스트, (필요 시) Cloud Functions
```

---

## 7. Convention Prerequisites

### 7.1 Existing Conventions (웹에서 계승)

- [x] 날짜는 로컬 기준 `YYYY-MM-DD` 문자열, UTC 변환 금지
- [x] 도메인 값(하루 목표, 반납 기한 등)은 상수로 고정하지 않고 사용자 입력 — 기본값만 설정으로 둔다
- [x] 기록은 도달 페이지만 저장, 파생값은 계산

### 7.2 Conventions to Define (Design 단계)

| Category | To Define | Priority |
|----------|-----------|:--------:|
| Dart 스타일 | `flutter_lints` 기반 분석 규칙, 파일/클래스 네이밍 | High |
| 폴더 구조 | 위 §6.3 확정 | High |
| Firestore 필드명 | snake_case 유지 여부(웹과 동일) vs camelCase | Medium |
| 에러 처리 | 도메인 검증 에러 → 사용자 메시지 매핑 | Medium |
| 문자열 | 모든 UI 문자열 ARB 관리 | Medium |
| 브랜치/릴리스 | 버전 규칙(semver + 빌드 번호), 스토어 트랙별 배포 절차 | Medium |

### 7.3 Environment / Configuration Needed

| 항목 | 용도 | 비고 |
|------|------|------|
| Firebase 프로젝트 (dev, prod) | Auth, Firestore, Crashlytics, Analytics | FlutterFire CLI로 플랫폼별 설정 파일 생성 |
| iOS: Bundle ID, Apple Developer 계정, Sign in with Apple 설정, APNs(로컬 알림 권한) | 빌드·서명·로그인 | 연간 멤버십 필요 |
| Android: applicationId, 서명 키(Play App Signing), Google 로그인 SHA 지문 | 빌드·서명·로그인 | Play Console 계정 필요 |
| 개인정보처리방침·이용약관·계정 삭제 안내 URL | 스토어 필수 | 정적 페이지 호스팅 |
| 지원 이메일 | 스토어 필수 | |

> 설정 파일(예: `GoogleService-Info.plist`, `google-services.json`)과 서명 키는 저장소 정책에 맞게 관리하고, 서명 키·키스토어 비밀번호는 절대 커밋하지 않는다.

---

## 8. Milestones (제안)

기간은 개발 가용 시간에 맞춰 Design 단계에서 확정한다.

| 단계 | 내용 | 완료 기준 |
|------|------|-----------|
| M0 준비 | Firebase 프로젝트(dev/prod), 개발자 계정, 번들/패키지 ID, 리포 생성, Play 비공개 테스트 조건 확인 | 빈 앱이 두 플랫폼에서 Firebase에 연결됨 |
| M1 도메인 | 웹 계산·검증 로직 Dart 이식 + 단위 테스트 | 웹 시나리오 테스트 전부 통과 |
| M2 핵심 화면 | 로그인, 책 등록/수정, 오늘의 독서(체크·완독), 목록, 잔디 | 전체 흐름 실기기 동작 |
| M3 앱 완성도 | 오프라인, 리마인더, 설정, 계정 삭제, 다크 모드, 접근성, 보안 규칙 테스트 | Must/Should 요구사항 구현 |
| M4 비공개 테스트 | TestFlight, Play 비공개 테스트 트랙, 피드백 반영 | 치명 이슈 0건, Play 조건 충족 |
| M5 출시 | 스토어 등록 정보·공시 작성, 심사 제출, 공개 | 두 스토어 공개 |

---

## 9. Open Questions (Design 전 확인 필요)

1. **앱 이름·브랜딩** — 스토어 등록명, 아이콘 방향
2. **개발자 계정 유형** — 개인 / 조직(사업자) 계정. Google Play 비공개 테스트 의무 여부와 판매자 표시명이 달라진다
3. **이메일 로그인 제공 여부** — Apple·Google 외에 이메일/비밀번호가 필요한지
4. **리마인더 기본값** — 기본으로 꺼 둘지, 첫 실행에 켜기를 제안할지
5. **잔디 표시 기간** — 모바일 화면에서 보여줄 기간(웹은 최근 1년). 사용자 설정으로 둘지
6. **분석 이벤트 범위** — 어떤 이벤트를 수집할지(개인정보 공시와 연동)

---

## 10. Next Steps

1. [ ] Open Questions 답변
2. [ ] Design 문서 작성 (`docs/02-design/features/reading-log-mobile.design.md`) — Firestore 데이터 구조·보안 규칙, 오프라인 쓰기 방식, 검증 분담, 화면 흐름, 계정 삭제 방식
3. [ ] M0 준비 착수 (계정·Firebase 프로젝트)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-25 | Initial draft | Mincoln Cho |
