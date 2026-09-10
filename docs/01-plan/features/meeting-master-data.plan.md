---
template: plan
version: 1.3
---

# meeting-master-data Planning Document

> **Summary**: 회의록 "파트별" 섹션의 파트/담당자 입력을 자유 텍스트에서 select 박스로 전환하고, select 박스 안의 "+ 추가" 옵션으로 모달을 열어 즉시 새 항목을 등록할 수 있게 한다. 이를 위해 파트/담당자 이름을 저장하는 마스터 데이터 테이블을 신설한다
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-08
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 파트/담당자를 자유 텍스트로 입력하다 보니 같은 대상이 "BE"/"백엔드"처럼 표기가 흩어질 수 있고, 오탈자가 나면 파트별 그룹핑(직전 기능)이 깨진다 |
| **Solution** | 파트/담당자 이름을 마스터 데이터 테이블에 저장하고, "파트별" 섹션의 입력 폼에서 select 박스로 선택하게 한다. 목록에 없는 새 이름은 별도 관리 화면 없이 select 박스 안의 "+ 새 항목 추가" 옵션 → 모달에서 바로 등록한다 |
| **Function/UX Effect** | 파트별 섹션 추가/수정 폼의 "파트"/"담당자" 입력이 텍스트 input에서 select로 바뀌고, select 맨 아래 "+ 추가" 옵션을 고르면 모달이 열려 이름을 입력·등록하면 그 값이 즉시 선택된 상태로 반영된다. 모달에는 기존 항목 삭제 기능도 포함된다 |
| **Core Value** | 표기 일관성을 강제해 파트별 그룹핑 기능의 신뢰성을 높이고, 반복 입력 시 오탈자/표기 흔들림을 방지한다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 파트/담당자가 자유 텍스트라 표기가 흩어져 파트별 그룹핑 신뢰성이 떨어짐 |
| **WHO** | 회의록을 정리하고 파트별 진행상황을 추적하는 사용자(팀 리드/매니저) |
| **RISK** | 기존에 자유 텍스트로 이미 입력된 파트/담당자 값과의 정합성 확보(자동 시딩 필요), 마스터 삭제가 과거 기록에 영향을 주지 않도록 설계해야 함 |
| **SUCCESS** | 파트별 섹션의 파트/담당자 입력이 select 박스로 동작하고, select 안에서 새 항목 추가/삭제가 가능하며, 기존 자유 텍스트 값이 마스터에 자동 반영됨 |
| **SCOPE** | (1) 파트/담당자 마스터 데이터 테이블 신설 (2) 마스터 목록 조회/등록/삭제 API (3) 파트별 섹션 입력을 select+"추가" 모달로 전환 (4) 기존 자유 텍스트 값 자동 시딩 |

---

## 1. Overview

### 1.1 Purpose

회의록 "파트별" 섹션에서 파트/담당자를 자유 텍스트가 아닌, 미리 등록된 값 중에서 select 박스로 선택하도록 바꾼다. 새 값이 필요하면 별도 관리 화면 없이 select 박스 안의 "+ 추가" 옵션으로 그 자리에서 등록한다.

### 1.2 Background

직전 기능([[meeting-minutes]])에서 "파트별" 섹션에 `part`(파트명) 필드를 추가하고 파트별로 그룹핑해서 보여주는 기능을 구현했다. 사용자가 이어서 다음을 요청했다:

- 파트/담당자를 자유 텍스트가 아니라 select 박스로 선택하게 해달라
- 처음에는 "회의록 페이지 상단에 '관리' 버튼을 눌러 별도 화면에서 등록"하는 방식을 제안했으나, 대화 중 "별도 관리 메뉴보다 select 박스 안에 '추가' 옵션을 눌러 모달로 등록하는 게 낫겠다"고 방향을 수정함 — **최종 방식은 select 박스 내장 "+ 추가" 모달**이다
- 이 기능을 위해서는 파트/담당자 이름을 저장할 별도 테이블(마스터 데이터)이 필요하다

대화에서 확인한 추가 결정 사항:
- 담당자 목록은 파트와 무관한 전체 공용 목록으로 관리한다(파트별로 종속된 담당자 목록이 아님)
- 기존에 자유 텍스트로 이미 입력된 파트/담당자 값(예: "BE", "박찬준")은 화면에 처음 조회될 때 자동으로 마스터 목록에 채워 넣는다(레거시 데이터 시딩)
- 마스터 목록에 대해 이번 스코프에서는 등록(추가)과 삭제까지 지원한다(이름 수정/rename은 범위 밖)

### 1.3 Related Documents

- 선행 기능: [[meeting-minutes]] — `docs/01-plan/features/meeting-minutes.plan.md`, `docs/02-design/features/meeting-minutes.design.md` (파트별 섹션의 `part`/`assignee`/`kind`/`content` 필드가 이번 기능의 대상)
- 참고 컴포넌트: `client/src/components/MeetingMinutes/MeetingMinutes.jsx` — 파트별 섹션 추가/수정 폼

---

## 2. Scope

### 2.1 In Scope

- [ ] 파트/담당자 이름을 저장하는 마스터 데이터 테이블(컬렉션) 신설 — 파트와 담당자를 하나의 테이블로 통합할지, 2개로 분리할지는 Design 단계에서 결정
- [ ] 마스터 목록 조회 API (`GET`) — 파트 목록, 담당자 목록을 각각 조회
- [ ] 마스터 항목 등록 API (`POST`) — 동일 이름(공백/대소문자 무시) 중복 등록 거부
- [ ] 마스터 항목 삭제 API (`DELETE`)
- [ ] "파트별" 섹션의 추가/수정 폼에서 "파트"/"담당자" 입력을 텍스트 input → select 박스로 변경
- [ ] select 박스에 "+ 새 항목 추가" 옵션 추가 — 선택 시 모달이 열려 이름 입력 → 등록 → 그 값이 select에 자동 선택
- [ ] 모달 내에서 기존 마스터 항목을 삭제할 수 있는 간단한 목록 UI
- [ ] 기존에 자유 텍스트로 저장된 파트/담당자 값을 최초 조회 시 마스터 목록에 자동으로 채워 넣는 시딩 로직(서버 측, upsert 방식으로 중복 생성 방지)

### 2.2 Out of Scope

- 담당자를 특정 파트에 종속시키는 소속 관계 관리(담당자는 파트와 무관한 전체 공용 목록)
- 마스터 항목 이름 수정(rename) — 이번 스코프는 추가/삭제까지만
- 마스터 항목을 삭제/변경해도 과거에 이미 저장된 파트별 항목의 문자열 값은 소급 변경되지 않음(참조 무결성 없이 단순 문자열 저장 유지)
- "액션아이템" 섹션의 "담당자" 입력에는 이번 스코프를 적용하지 않는다(파트별 섹션에 한정) — 필요 시 별도 기능으로 후속 진행
- select 박스의 검색/자동완성 UX 고도화(항목이 많아질 경우 대비) — 기본 HTML select로 시작

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 파트/담당자 마스터 데이터를 저장하는 테이블(컬렉션)을 정의한다 | High | Pending |
| FR-02 | 파트 마스터 목록과 담당자 마스터 목록을 각각 조회하는 API를 제공한다 | High | Pending |
| FR-03 | 마스터 항목(파트 또는 담당자)을 새로 등록하는 API를 제공하며, 동일 종류 내 중복 이름(trim, 대소문자 무시)은 거부한다 | High | Pending |
| FR-04 | 마스터 항목을 삭제하는 API를 제공한다. 삭제는 마스터 목록에서만 제거하며, 이미 저장된 파트별 항목의 문자열 값에는 영향을 주지 않는다 | Medium | Pending |
| FR-05 | "파트별" 섹션 추가 폼의 "파트"/"담당자" 입력이 select 박스로 동작하며, 마스터 목록을 옵션으로 보여준다 | High | Pending |
| FR-06 | "파트별" 섹션 수정(인라인 편집) 폼의 "파트"/"담당자" 입력도 동일하게 select 박스로 동작한다 | High | Pending |
| FR-07 | select 박스에 "+ 새 항목 추가" 옵션이 있으며, 선택하면 모달이 열려 이름을 입력해 등록할 수 있다. 등록 성공 시 모달이 닫히고 방금 등록한 값이 select에 선택된 상태로 반영된다 | High | Pending |
| FR-08 | 모달 안에서 기존 마스터 항목 목록을 보여주고, 항목별로 삭제할 수 있다 | Medium | Pending |
| FR-09 | 회의록 상세 화면에 처음 진입할 때(또는 회의록 목록 최초 로드 시), 아직 마스터에 없는 기존 파트/담당자 자유 텍스트 값을 자동으로 마스터 목록에 채워 넣는다. 여러 번 실행돼도 중복 생성되지 않는다(upsert) | Medium | Pending |
| FR-10 | 담당자 마스터 목록은 파트와 무관하게 전체 회의록에서 공용으로 취급한다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|---------------------|
| 데이터 일관성 | 동일 종류(파트/담당자) 내에서 trim/대소문자 무시 기준으로 중복 이름이 저장되지 않음 | 수동 테스트(같은 이름 다른 대소문자로 등록 시도) |
| 하위 호환성 | 마스터 삭제/미시딩 상태에서도 기존 파트별 항목 조회/그룹핑이 깨지지 않음 | 수동 테스트 |
| 회귀 방지 | 액션아이템 섹션 및 다른 기존 탭의 동작에 영향 없음 | 수동 테스트 |
| 규모 가정 | 로컬 단일 사용자, 파트/담당자 각각 수십 개 이내 — 페이지네이션/검색 최적화 불필요 | 해당 없음 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 파트별 섹션 추가 폼의 "파트"/"담당자"가 select 박스로 표시되고, 마스터 목록의 값을 선택할 수 있다
- [ ] 파트별 섹션 인라인 수정 폼도 동일하게 select 박스로 동작한다
- [ ] select에서 "+ 추가"를 선택하면 모달이 열리고, 이름을 입력해 등록하면 목록에 반영되며 해당 값이 즉시 선택된다
- [ ] 모달에서 기존 항목을 삭제할 수 있다
- [ ] 동일 이름(공백/대소문자 무시)을 다시 등록하면 거부된다
- [ ] 기존 회의록에 자유 텍스트로 저장돼 있던 파트/담당자 값이 최초 조회 시 마스터 목록에 자동으로 나타난다
- [ ] 새로고침 후에도 마스터 목록과 파트별 항목이 그대로 유지된다
- [ ] 액션아이템 섹션 등 기존 기능에 회귀 없음

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(select에서 항목 선택 → "+ 추가"로 새 파트/담당자 등록 → 즉시 선택 확인 → 모달에서 삭제 → 기존 회의록 열어 레거시 값 자동 시딩 확인) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 레거시 값 자동 시딩 로직이 여러 번(혹은 여러 클라이언트에서 동시에) 실행되면 중복 마스터 항목이 생길 수 있음 | Medium | Medium | 서버에서 등록 전 존재 여부를 확인하는 upsert 방식으로 처리(FR-09) |
| 마스터 항목을 삭제해도 과거 파트별 항목의 문자열 값은 그대로 남아 있어, "삭제했는데 왜 계속 보이지" 같은 혼란이 생길 수 있음 | Medium | Medium | Design 문서에 동작을 명확히 기술하고, UI 문구로 "마스터 목록에서만 삭제됨" 안내 |
| 파트/담당자 마스터를 하나의 테이블로 통합할지 분리할지에 따라 API 형태가 달라짐 | Low | Low | Design 단계에서 3가지 아키텍처 옵션 비교 후 결정 |
| select 박스 옵션이 많아지면(파트/담당자가 늘어나면) 찾기 어려워질 수 있음 | Low | Low | 이번 스코프는 기본 select로 충분하다고 판단, 필요 시 후속 개선(검색형 select) |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| 파트/담당자 마스터 테이블(명칭은 Design에서 확정) | DB Schema | 신규 테이블(컬렉션) 추가 |
| `server/routes/meetings.js` 또는 신규 라우트 파일 | API | 마스터 목록 조회/등록/삭제 엔드포인트 추가 (기존 `meetings.js` 엔드포인트는 무변경) |
| `client/src/components/MeetingMinutes/MeetingMinutes.jsx` | Component | "파트별" 섹션의 파트/담당자 입력을 input → select + "추가" 모달로 변경 (다른 섹션 UI는 무변경) |
| `client/src/hooks/useMeetings.js` 또는 신규 훅 | Hook | 마스터 목록 로드 + 등록/삭제 액션 추가 |
| `client/src/api/meetings.js` 또는 신규 API 클라이언트 파일 | API Client | 마스터 목록 fetch 래퍼 추가 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `meeting_part_items`(파트/담당자 필드) | READ | `GET /api/meetings/:id` → `MeetingMinutes.jsx` 파트별 섹션 렌더 | None — 저장 형태(문자열)는 그대로 유지, 입력 UI만 select로 변경 |
| `meeting_part_items`(파트/담당자 필드) | CREATE/UPDATE | `POST/PATCH .../part-items` | None — 여전히 문자열 값을 받아 저장, 값의 출처가 select로 바뀔 뿐 API 계약은 동일 |

### 6.3 Verification

- [ ] 신규 마스터 관련 API/컴포넌트가 기존 `meeting` 접두사 네이밍과 충돌하지 않는지 확인
- [ ] 파트별 섹션 외 다른 섹션(전체/액션아이템) 코드는 수정하지 않았는지 확인
- [ ] 마스터 목록이 비어 있는 상태(신규 사용자)에서도 select가 "+ 추가"만으로 정상 동작하는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 React(Vite) + Express + Firebase Firestore(`firebase-admin`) 스택이다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 상태 관리 | 로컬 React state + custom hook | 기존 `useMeetings` 패턴 확장 또는 신규 훅 |
| API 클라이언트 | 순수 `fetch` 래퍼 | 기존 `api/meetings.js` 컨벤션 재사용 |
| 백엔드 | Express + Firestore(`firebase-admin`) | 기존과 동일 |
| DB | Firestore | 기존과 동일, 신규 컬렉션만 추가 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 마스터 테이블 구조 | (A) 파트/담당자를 각각 별도 컬렉션 / (B) 하나의 컬렉션에 `type: 'part'\|'assignee'` 컬럼으로 구분 | Design 단계에서 확정 (경향: B) | `meeting_overall_items.kind`, `meeting_part_items.kind`에서 이미 검증된 "동일 셰이프 + kind 컬럼" 패턴과 일관되며, 두 목록 모두 "이름 하나"라는 동일한 셰이프이므로 통합이 단순함 |
| 신규값 등록 UX | (A) 회의록 페이지 상단 "관리" 버튼 → 별도 관리 화면 / (B) select 박스 내 "+ 추가" 옵션 → 모달 | **(B)** | 사용자가 대화 중 별도 관리 화면보다 select 내장 방식이 낫다고 명시적으로 방향을 수정함 — 입력 흐름을 끊지 않고 그 자리에서 등록 가능 |
| 레거시 데이터 처리 | (A) 마이그레이션 스크립트로 1회성 일괄 시딩 / (B) 서버 조회 시점에 자동 시딩(upsert) | **(B)** | `meeting_part_items`의 구 스키마 정규화(`normalizePartItem`)와 동일하게, 별도 스크립트 실행 없이 자연스럽게 반영되는 방식을 선호 |

### 7.3 폴더 구조 변화 (예상)

```
server/
├── db/collections.js          # 마스터 컬렉션 이름 상수 추가
├── routes/meetings.js         # 마스터 목록 조회/등록/삭제 엔드포인트 추가 (또는 별도 라우트 파일)
└── ...

client/src/
├── api/meetings.js            # 마스터 목록 fetch 래퍼 추가 (또는 신규 파일)
├── hooks/useMeetings.js       # 마스터 목록 로드 + 등록/삭제 액션 추가
└── components/MeetingMinutes/
    └── MeetingMinutes.jsx     # 파트별 섹션 입력을 select + "추가" 모달로 변경
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [x] 최근 커밋에서 `meeting_part_items`에 `kind` 컬럼을 도입한 전례 존재 — 이번 기능의 마스터 테이블 구조 결정에 참고

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 마스터 데이터 API 경로 | 없음(신규) | `/api/meetings`와 독립된 경로로 둘지, `meetings.js` 안에 포함할지 Design에서 결정 | High |
| 중복 검사 방식 | 없음(신규) | trim + 대소문자 무시 비교 로직을 서버 어디에 둘지 | Medium |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`meeting-master-data.design.md`) — 마스터 테이블 통합/분리 최종 결정, API 상세 스펙, select+모달 컴포넌트 구조
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do meeting-master-data`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-08 | Initial draft | Mincoln Cho |
