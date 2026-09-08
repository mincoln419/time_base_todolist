---
template: plan
version: 1.3
---

# focusmap-item-rework Planning Document

> **Summary**: 포커스 맵 겹쳐 보기(3단계) 결과에서 "쪼개기"·"보류"로 분류된 항목을, 전체를 처음부터 다시 매기지 않고도 개별적으로 텍스트/점수를 수정하거나 더 작은 행동으로 쪼개 추가할 수 있게 하는 기능
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-07
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 3단계(겹쳐 보기)에서 "쪼개기"·"보류"로 분류된 항목을 고치려면 유일한 수단인 "다시 매기기"가 모든 항목의 영향력/능력 점수를 초기화하고 1판부터 다시 시작시켜, 항목 하나만 손보고 싶어도 전체를 다시 매겨야 한다 |
| **Solution** | 결과 표의 "쪼개기"·"보류" 행에 "재작업" 버튼을 추가하고, 클릭 시 뜨는 모달에서 텍스트와 영향력·능력 점수를 그 항목만 수정하거나, 같은 입력값으로 새 항목을 목록에 추가(분할)할 수 있게 한다 |
| **Function/UX Effect** | 다른 항목의 점수와 전체 진행 단계를 건드리지 않고, 문제가 있는 항목만 바로 고쳐 "황금 행동"으로 바꾸거나 더 쉬운 행동으로 쪼갤 수 있다 |
| **Core Value** | 재작업 비용을 "항목 1개 수정"으로 낮춰, 겹쳐 보기 결과를 실제로 다듬어 쓰는 도구로 만든다 |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | "다시 매기기"만 있어 쪼개기/보류 항목의 사소한 수정도 전체 재작업(1판부터 다시)을 강제함 |
| **WHO** | 포커스 맵을 반복 사용하며 겹쳐 보기 결과를 실제로 다듬어 실행으로 옮기는 단일 사용자 |
| **RISK** | 재작업 후 이미 "할일로 추가"된 항목과 텍스트/판정이 어긋날 수 있음, 모달이라는 신규 UI 패턴 도입 |
| **SUCCESS** | 쪼개기/보류 항목을 개별로 수정·재평가하거나 새 항목으로 분할 추가할 수 있고, 다른 항목 점수·진행 단계는 그대로 유지됨 |
| **SCOPE** | (1) 재작업 모달 UI (2) 개별 항목 텍스트/점수 수정 로직 (3) 새 항목 분할 추가 로직 (4) 재작업 버튼 노출 조건 (쪼개기·보류 + 미추가 항목만) |

---

## 1. Overview

### 1.1 Purpose

포커스 맵(BJ Fogg 행동 설계) 3단계 "겹쳐 보기" 결과에서, "쪼개기"·"보류"로 분류된 항목을 개별적으로 재작업(텍스트 수정, 점수 재평가, 새 항목 분할 추가)할 수 있는 프로세스를 추가한다.

### 1.2 Background

현재 `FocusMap.jsx`의 3단계 결과 화면에는 항목별 판정(`verdictOf`: 황금 행동/쪼개기/보류/버리기)이 표시되지만, 재작업 수단은 `redo()`(다시 매기기) 하나뿐이다. `redo()`는 **모든 항목**의 `impact`/`ability`를 `null`로 초기화하고 `step`을 1로, `cursor`를 0으로 되돌려 1판부터 순서대로 다시 매기게 한다. 결과적으로 항목 12개 중 1개만 손보고 싶어도 12개를 전부 다시 평가해야 한다.

사용자와 확정한 방향:

- 재작업 시 허용할 조작: **텍스트 수정 + 개별 항목 재평가 + 새 항목으로 분할 추가**를 모두 지원한다.
- 재작업 프로세스는 **"쪼개기"·"보류" 판정 항목에만** 적용한다 (황금 행동·버리기 항목은 대상 아님).
- 재작업 UI는 **클릭 시 열리는 모달/패널** 형태로 한다.
- 재작업 이력(원래 점수 등)은 **별도로 기록하지 않는다** — 현재 값만 유지한다.

### 1.3 Related Documents

- 선행 구현(포커스 맵 다중 세션): `docs/01-plan/features/focusmap-goals.plan.md`, `docs/02-design/features/focusmap-goals.design.md`
- 대상 코드: `client/src/components/FocusMap/FocusMap.jsx` (`verdictOf`, `redo`, 3단계 결과 표 렌더링), `client/src/hooks/useFocusMap.js`

---

## 2. Scope

### 2.1 In Scope

- [ ] 3단계 결과 표에서 판정이 "쪼개기" 또는 "보류"인 행에 "재작업" 버튼 표시 (이미 할일로 추가된 항목은 제외)
- [ ] "재작업" 버튼 클릭 시 모달을 열고, 해당 항목의 텍스트·영향력·능력 값을 미리 채운 편집 폼 표시
- [ ] 모달에서 텍스트 수정 + 영향력/능력 점수(1~5, 기존 IMPACT/ABILITY 라벨 재사용) 재선택
- [ ] "저장" 액션: 해당 항목만 새 텍스트/점수로 갱신, 다른 항목은 영향 없음, 판정 즉시 재계산
- [ ] "새 항목으로 추가" 액션: 모달의 현재 입력값으로 새 항목을 목록 끝에 추가, 원본 항목은 그대로 유지 (분할)
- [ ] 모달 "취소": 변경 없이 닫기
- [ ] 재작업 결과는 기존 세션 저장 로직(`update`/`commit`)으로 그대로 영속화

### 2.2 Out of Scope

- 황금 행동·버리기 항목에 대한 재작업
- 재작업 이력/변경 로그 기록
- 여러 항목을 한 번에 선택해 일괄 재작업
- 항목 삭제(3단계에서의 삭제 UI) — 기존에도 없던 기능이며 이번 범위에 포함하지 않음
- 재작업 후 "할일로 추가됨" 상태 항목의 역동기화 (기존 Out of Scope 유지)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 3단계 결과 표에서 판정이 `cut`(쪼개기) 또는 `hold`(보류)이고 `addedTaskIds`에 포함되지 않은 행에만 "재작업" 버튼을 표시한다 | High | Pending |
| FR-02 | "재작업" 버튼 클릭 시 모달이 열리고, 해당 항목의 현재 텍스트·영향력·능력 값이 채워진 편집 폼을 보여준다 | High | Pending |
| FR-03 | 모달에서 텍스트를 수정하고, 영향력/능력 점수를 1~5 버튼(기존 IMPACT/ABILITY 라벨)으로 다시 선택할 수 있다 | High | Pending |
| FR-04 | "저장" 클릭 시 해당 항목의 `text`/`impact`/`ability`만 갱신되고, 다른 항목의 값은 변경되지 않는다. `step`/`cursor`도 그대로 유지된다 (전체 재시작 아님) | High | Pending |
| FR-05 | 저장 직후 해당 항목의 판정(`verdictOf`)이 재계산되어 결과 표 정렬·2x2 플롯 위치·판정 배지에 즉시 반영된다 | High | Pending |
| FR-06 | "새 항목으로 추가" 클릭 시, 모달의 현재 입력값(텍스트+점수)으로 새 `id`를 가진 항목이 `items` 배열 끝에 추가되고, 원본 항목은 수정되지 않는다 | High | Pending |
| FR-07 | 모달 "취소" 클릭 시 아무 것도 변경하지 않고 모달만 닫는다 | Medium | Pending |
| FR-08 | 텍스트가 공백만 있거나 비어 있으면 "저장"/"새 항목으로 추가" 모두 비활성화한다 (기존 `addBeh` 검증과 동일 수준) | Medium | Pending |
| FR-09 | 재작업 결과는 기존 `useFocusMap`의 `update`(자동 저장) 흐름을 그대로 사용해 세션에 저장된다 (별도 저장 API 신설 없음) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 일관성 | 재작업 모달의 점수 선택 UI는 기존 1판/2판 화면과 동일한 라벨(IMPACT/ABILITY)·1~5 버튼 스타일을 재사용 | 코드 리뷰 |
| 회귀 방지 | 기존 "다시 매기기"(전체 재시작), "할일로 추가" 흐름이 그대로 동작 | 수동 테스트 |
| 데이터 무결성 | 이미 할일로 추가된 항목(`addedTaskIds` 포함)은 재작업 대상에서 제외되어 표시 텍스트와 실제 할일 텍스트가 어긋나지 않음 | 수동 테스트 |
| 이력 없음 | 재작업 전 값은 어디에도 별도 저장하지 않는다 (요구사항 확정 사항) | 코드 리뷰 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 쪼개기/보류 항목에서 "재작업" 버튼으로 텍스트·점수를 수정해 저장하면, 해당 항목만 갱신되고 다른 항목 점수는 그대로 유지된다
- [ ] 능력 점수를 4 이상으로 올려 저장하면 판정이 즉시 "황금 행동"으로 바뀌어 표/플롯에 반영된다
- [ ] "새 항목으로 추가"를 사용하면 원본 항목은 그대로 남고, 새 항목이 목록에 추가되어 즉시 판정된 상태로 표시된다
- [ ] "다시 매기기"(전체 재시작) 버튼은 기존과 동일하게 전체 항목을 초기화하며 회귀 없음
- [ ] "할일로 추가됨" 상태 항목에는 "재작업" 버튼이 나타나지 않는다
- [ ] 황금 행동·버리기 판정 항목에는 "재작업" 버튼이 나타나지 않는다

### 4.2 Quality Criteria

- [ ] `npx vite build` 성공
- [ ] 브라우저에서 실제 시나리오(쪼개기 항목 재작업 → 황금 행동 전환 확인, 보류 항목 분할 추가 확인) 수동 검증

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 재작업 후 텍스트/점수가 바뀌어도 이미 "할일로 추가된" 항목과 내용이 어긋남 | Medium | Low | FR-01로 `addedTaskIds` 포함 항목은 재작업 대상에서 원천 제외 |
| 모달이라는 신규 UI 패턴이 기존 인라인 위주 스타일과 이질적일 수 있음 | Low | Medium | 기존 Tailwind 유틸리티·색상 톤을 재사용해 단순 오버레이+카드로 구현 (신규 라이브러리 도입 없음) |
| "새 항목으로 추가" 시 `uid()` 충돌 | Low | Low | 기존 `uid()` 함수(랜덤 base36) 그대로 재사용 |
| 재작업으로 판정이 바뀌며 2x2 플롯 좌표(`jitter`)가 겹쳐 혼동될 수 있음 | Low | Low | 기존 `jitter(id)`가 id 기반이라 항목별 위치가 안정적으로 유지됨 — 별도 대응 불필요 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `client/src/components/FocusMap/FocusMap.jsx` | Component | 3단계 결과 표에 "재작업" 버튼·모달 상태·저장/분할 핸들러 추가 (기존 `verdictOf`, `TAG_COLORS`, `uid` 재사용) |
| 재작업 모달 (신규) | Component (Design에서 파일 분리 여부 결정) | 텍스트 입력 + 영향력/능력 1~5 선택 + 저장/분할 추가/취소 버튼 |
| `client/src/hooks/useFocusMap.js` | Hook | 변경 없음 — 기존 `update`(자동 저장) 그대로 재사용 |
| `server/routes/focusmap.js`, `focus_map` 스키마 | API/DB | 변경 없음 — 세션 데이터 형태(`items` 배열)에 새 필드 추가 없이 기존 항목 구조 그대로 사용 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `state.items` | READ/WRITE | `FocusMap.jsx` 내부 `update()` 호출들 (`pick`, `redo`, `convertSelectedToTasks` 등) | None — 새 핸들러도 동일한 `update((prev) => ...)` 패턴으로 `items` 배열만 갱신, 기존 흐름과 충돌 없음 |
| `verdictOf` | READ | 3단계 표/플롯 렌더링 | None — 순수 함수, 입력(impact/ability)만 바뀔 뿐 로직 변경 없음 |

### 6.3 Verification

- [ ] 재작업 핸들러가 `items` 배열 중 대상 항목(또는 새 항목)만 변경하고 나머지는 참조 동일성 문제없이 유지하는지 확인
- [ ] 재작업 후 세션 저장(`update`)이 기존 자동 저장 흐름과 동일하게 동작하는지 확인 (Design 단계에서 저장 트리거 시점 결정)
- [ ] 기존 `focusmap-goals` 기능(목표별 다중 세션, 할일 변환)과 회귀 없는지 확인

---

## 7. Architecture Considerations

> 본 프로젝트는 bkit의 Starter/Dynamic/Enterprise(Next.js/bkend.ai 프리셋) 분류 대상이 아닌, React(Vite) + Express + Firestore 커스텀 스택이다. 아래 표는 실제 스택 기준으로 작성한다.

### 7.1 스택 요약 (기존 프로젝트 유지)

| 항목 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Tailwind | 기존과 동일, 신규 도입 없음 |
| 상태 관리 | 로컬 React state + custom hook (`useFocusMap`) | 기존 패턴 재사용, 모달 open/close 상태만 컴포넌트 로컬 state로 추가 |
| 저장 | 기존 `update`(자동 저장) 흐름 | 별도 API 신설 없음 |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 재작업 UI 형태 | (A) 표 인라인 편집 / (B) 클릭 시 모달·패널 | **(B)** | 사용자 확정 사항 — 텍스트+점수 2개 필드를 한 번에 다루기엔 모달이 표 레이아웃을 어지럽히지 않음 |
| "쪼개기" 구현 방식 | (A) 원본 항목을 여러 개로 치환 / (B) 원본은 유지하고 새 항목을 추가 | **(B)** | 사용자가 "저장"(덮어쓰기)과 "새 항목으로 추가"(분할)를 별개 액션으로 명시적으로 선택하게 하여, 실수로 원본을 잃는 상황을 방지 |
| 재작업 대상 판정 | (A) 모든 판정 허용 / (B) 쪼개기·보류만 | **(B)** | 사용자 확정 사항 — 황금 행동/버리기는 이미 결론이 난 항목이므로 재작업 UI 노출 불필요 |
| 이력 관리 | (A) 이전 값 별도 저장 / (B) 기록 없이 현재 값만 유지 | **(B)** | 사용자 확정 사항 — 단일 사용자 로컬 도구로 이력 추적 불필요 |

### 7.3 폴더 구조 변화 (예상)

```
client/src/components/FocusMap/
├── FocusMap.jsx              # 재작업 버튼 노출 조건, 모달 open/close 상태, save/split 핸들러 추가
└── FocusMapReworkModal.jsx   # (신규, Design에서 분리 여부 최종 결정) 텍스트+점수 편집 폼
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`에 코딩 컨벤션 섹션 존재 (Simplicity First, Surgical Changes 등)
- [ ] 별도 `docs/01-plan/conventions.md` 없음 — 기존 코드 스타일(컴포넌트 내부 헬퍼 함수, Tailwind 유틸리티 클래스 직접 사용) 그대로 따름

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 모달 패턴 | 프로젝트 내 기존 모달 컴포넌트 없음 | 신규 모달을 오버레이(고정 배경)+카드 형태로 최소 구현, 별도 모달 라이브러리 도입 안 함 | High |
| 점수 선택 UI | 1판/2판 화면에 이미 5버튼 그리드 패턴 존재 (`IMPACT`/`ABILITY` 배열 + 버튼 map) | 모달 내부에서도 동일 배열/버튼 스타일 재사용 (중복 스타일 신설 금지) | High |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`focusmap-item-rework.design.md`) — 모달 컴포넌트 분리 여부, 저장 시점(즉시 vs 확인), 상태 관리 상세 구조 확정
2. [ ] 사용자 리뷰 및 승인
3. [ ] 구현 시작 (`/pdca do focusmap-item-rework`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-07 | Initial draft | Mincoln Cho |
