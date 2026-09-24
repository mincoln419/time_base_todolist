---
template: design
version: 1.3
---

# focusmap-item-rework Design Document

> **Summary**: 포커스 맵 겹쳐 보기(3단계) 결과에서 "쪼개기"·"보류" 항목을 개별적으로 수정·재평가하거나 새 항목으로 분할 추가하는 재작업 모달의 설계
>
> **Project**: time_based_todolist
> **Version**: 0.1.0
> **Author**: Mincoln Cho
> **Date**: 2026-09-07
> **Status**: Draft
> **Planning Doc**: [focusmap-item-rework.plan.md](../../01-plan/features/focusmap-item-rework.plan.md)

> **Pipeline 참고**: 이 프로젝트는 9-phase Development Pipeline(schema.md/conventions.md 등)을 사용하지 않으므로 Pipeline References 섹션은 생략한다.

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | "다시 매기기"만 있어 쪼개기/보류 항목의 사소한 수정도 전체 재작업(1판부터 다시)을 강제함 |
| **WHO** | 포커스 맵을 반복 사용하며 겹쳐 보기 결과를 실제로 다듬어 실행으로 옮기는 단일 사용자 |
| **RISK** | 재작업 후 이미 "할일로 추가"된 항목과 텍스트/판정이 어긋날 수 있음, 모달이라는 신규 UI 패턴 도입 |
| **SUCCESS** | 쪼개기/보류 항목을 개별로 수정·재평가하거나 새 항목으로 분할 추가할 수 있고, 다른 항목 점수·진행 단계는 그대로 유지됨 |
| **SCOPE** | (1) 재작업 모달 UI (2) 개별 항목 텍스트/점수 수정 로직 (3) 새 항목 분할 추가 로직 (4) 재작업 버튼 노출 조건 (쪼개기·보류 + 미추가 항목만) |

> Design Anchor(Pencil MCP) 섹션은 이 기능에 해당 없어 생략한다 — 기존 화면 톤앤매너(Tailwind, blue-500 accent)를 그대로 따른다.

---

## 1. Overview

### 1.1 Design Goals

- "쪼개기"·"보류" 항목을 다른 항목·진행 단계를 건드리지 않고 개별적으로 재작업(텍스트 수정, 점수 재평가, 분할 추가)할 수 있게 한다.
- 신규 API·DB 변경 없이, 기존 세션 저장 흐름(`useFocusMap`의 `update`)만으로 재작업 결과가 영속화되게 한다.
- 재작업 모달은 기존 1판/2판 화면의 점수 선택 UI(IMPACT/ABILITY 5버튼)를 그대로 재사용해 학습 비용 없이 동일한 조작감을 준다.

### 1.2 Design Principles

- **로컬 상태 변경 원칙 유지**: 모든 재작업은 `state.items` 배열에 대한 순수 갱신이며, 기존 `pick`/`redo`와 동일하게 `update((prev) => ...)` 패턴만 사용한다 (별도 상태 관리 도입 없음).
- **필요한 만큼만 분리**: 모달 UI는 재사용 단위가 명확하므로 별도 컴포넌트로 분리하되, 판정 로직(`verdictOf`)·id 생성(`uid`)은 이미 `FocusMap.jsx`에 있는 것을 그대로 export해 쓴다 (도메인 모듈 신설 안 함).
- **백엔드 무변경**: 이 기능은 클라이언트 상태 조작만으로 완결되며, `server/routes/focusmap.js`·`focus_map` 컬렉션 스키마는 전혀 건드리지 않는다.

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 모달 JSX·로직 전부 FocusMap.jsx에 인라인 | 모달 + 판정 로직까지 별도 도메인 모듈로 분리 | 모달만 분리, 판정 로직은 FocusMap.jsx에 유지(export) |
| **New Files** | 0 | 2 | 1 |
| **Modified Files** | 1 | 2 | 1 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | Low (coupled) | Low (과설계) | Low (balanced) |
| **Recommendation** | Quick wins | Long-term projects | **Default choice** |

**Selected**: **Option C — Pragmatic Balance**
**Rationale**: 재작업 모달은 "항목 하나의 텍스트+점수를 편집"이라는 명확한 재사용 단위이므로 별도 컴포넌트로 분리할 가치가 있다. 반면 `verdictOf`/`uid`는 이미 `FocusMap.jsx`에 존재하고 이 기능 하나만을 위해 도메인 모듈을 신설하는 것은 프로젝트 규모(순수 JS, 리소스당 최소 파일)에 비해 과설계다. `focusmap-goals` 설계 때의 Option C 선택 기준과 동일하게 적용한다.

> 아래 상세 설계는 Option C를 기준으로 작성한다.

### 2.1 Component Diagram

```
┌────────────────────────┐
│ FocusMap.jsx            │
│  - state.items (session)│
│  - openRework/saveRework│
│  - addAsSplit           │
└──────────┬──────────────┘
           │ item, onSave, onAddSplit, onCancel
           ▼
┌────────────────────────┐
│ FocusMapReworkModal.jsx │  (신규, 순수 표시 + 로컬 입력 상태)
└────────────────────────┘

(서버/DB 변경 없음 — 저장은 기존 useFocusMap.update() → PUT /api/focusmap/:id 그대로 재사용)
```

### 2.2 Data Flow

```
결과 표(3단계)에서 "쪼개기"/"보류"이고 addedTaskIds에 없는 행 → "재작업" 버튼 노출
  → 클릭 시 reworkTargetId state 설정 → 해당 item으로 FocusMapReworkModal 렌더
  → 모달 내부: text/impact/ability 로컬 입력 상태 (item 값으로 초기화)
  → "저장" 클릭 → onSave(text, impact, ability)
      → FocusMap.jsx: update((prev) => items.map(it => it.id === target.id ? {...it, text, impact, ability} : it))
      → verdictOf가 즉시 재계산되어 표/플롯에 반영, useFocusMap의 기존 자동 저장(PUT)이 그대로 트리거됨
  → "새 항목으로 추가" 클릭 → onAddSplit(text, impact, ability)
      → FocusMap.jsx: update((prev) => ({...prev, items: [...prev.items, { id: uid(), text, impact, ability }]}))
      → 원본 항목은 변경되지 않음, 새 항목이 표/플롯에 즉시 등장
  → "취소" 또는 배경 클릭 → reworkTargetId를 null로, 상태 변경 없음
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `FocusMap.jsx` | `FocusMapReworkModal.jsx`, 기존 `verdictOf`/`uid`/`IMPACT`/`ABILITY` | 재작업 대상 상태 보유, 저장/분할 핸들러, 모달에 현재 값 전달 |
| `FocusMapReworkModal.jsx` | (props로만 데이터 수신, 훅/전역 상태 직접 접근 없음) | 텍스트+점수 편집 폼, 저장/분할/취소 액션을 콜백으로 위임 — 순수 표시 컴포넌트 |

---

## 3. Data Model

### 3.1 Entity Definition

**신규 필드 없음.** 기존 `focus_map` 세션의 `items` 배열 항목 shape(§3.1 of `focusmap-goals.design.md`)을 그대로 사용한다:

```
FocusMapItem
{
  id: string,                // 기존 uid() 재사용 (수정 시 유지, 분할 추가 시 새로 생성)
  text: string,               // 재작업으로 수정 가능
  impact: number | null,      // 1~5, 재작업으로 수정 가능
  ability: number | null,     // 1~5, 재작업으로 수정 가능
}
```

재작업은 기존 항목의 필드를 갱신하거나(저장) 동일 shape의 새 항목을 배열에 추가(분할)할 뿐이므로, 세션 JSON 구조·DB 스키마·API 계약 어느 것도 변경되지 않는다.

### 3.2 Entity Relationships

변경 없음 — `focus_map` ↔ `tasks` 관계(느슨한 결합, `addedTaskIds`)는 기존과 동일하게 유지된다.

### 3.3 Database Schema

변경 없음. `firestore.js`/`collections.js`/`focus_map` 문서 구조 그대로 사용한다.

---

## 4. API Specification

**신규/변경 엔드포인트 없음.** 재작업 결과는 기존 `PUT /api/focusmap/:id`(전체 세션 upsert)로만 저장되며, 이는 `useFocusMap`의 `update()` 호출 시 기존 로직이 그대로 처리한다. 별도 API 설계가 필요하지 않다.

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
겹쳐 보기(3단계) 결과 표
┌───┬────┬──────────────┬──────┬──────┬────────┬──────────┐
│[ ]│ 01 │ 매일 30분 읽기 │ ■■■■ │ ■■   │ 쪼개기  │ [재작업]  │ ← "재작업" 열 추가
├───┼────┼──────────────┼──────┼──────┼────────┼──────────┤
│추가│ 02 │ 서평 쓰기      │ ■■■■ │ ■■■■ │ 황금 행동│           │ ← 이미 추가됨/황금·버리기 판정 → 재작업 버튼 없음
└───┴────┴──────────────┴──────┴──────┴────────┴──────────┘

"재작업" 클릭 시:
┌──────────────────────────────────────────┐
│  재작업                              [x]  │
│  ────────────────────────────────────────│
│  행동 문구                                 │
│  [ 매일 1페이지 읽기                     ] │
│                                            │
│  영향력 (1~5)      능력 (1~5)              │
│  [1][2][3][4][5]   [1][2][3][4][5]        │
│                                            │
│  [ 취소 ]  [ 새 항목으로 추가 ]  [ 저장 ]   │
└──────────────────────────────────────────┘
```

### 5.2 User Flow

```
3단계 결과 표 → "쪼개기"/"보류" 행에서 "재작업" 클릭
  → 모달 오픈, 현재 텍스트·점수로 미리 채워짐
  ├─ 텍스트/점수 고쳐서 "저장" → 해당 항목만 갱신, 판정 즉시 재계산, 모달 닫힘
  ├─ 텍스트/점수 입력 후 "새 항목으로 추가" → 원본 유지 + 새 항목 추가, 모달 닫힘
  └─ "취소"(또는 배경/[x]) → 변경 없이 모달만 닫힘
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `FocusMap.jsx` | `client/src/components/FocusMap/` | 재작업 대상 상태(`reworkTargetId`) 보유, 저장/분할/취소 핸들러, 결과 표에 "재작업" 열 렌더링 (기존 컴포넌트 수정) |
| `FocusMapReworkModal.jsx` | `client/src/components/FocusMap/` | 텍스트 입력 + 영향력/능력 5버튼 선택 폼, 저장/분할/취소 버튼 (신규, 순수 표시 컴포넌트) |

### 5.4 Page UI Checklist

#### 겹쳐 보기(3단계) 결과 표 (기존 화면에 추가)

- [ ] 표 열 추가: "재작업" 버튼 — 판정이 `cut`(쪼개기) 또는 `hold`(보류)이고 `addedTaskIds`에 없는 행에만 표시
- [ ] 판정이 `gold`(황금 행동)/`drop`(버리기)이거나 이미 추가된 행에는 버튼 미표시 (빈 셀)

#### 재작업 모달 (FocusMapReworkModal, 신규)

- [ ] 텍스트 입력 필드: 대상 항목의 현재 `text`로 초기화, 자유 수정 가능
- [ ] 영향력 선택: 기존 `IMPACT` 배열 재사용한 1~5 버튼, 현재 `impact` 값이 선택 표시됨
- [ ] 능력 선택: 기존 `ABILITY` 배열 재사용한 1~5 버튼, 현재 `ability` 값이 선택 표시됨
- [ ] 버튼: "저장" — 텍스트가 공백이면 비활성화, 클릭 시 해당 항목만 갱신 후 모달 닫힘
- [ ] 버튼: "새 항목으로 추가" — 텍스트가 공백이면 비활성화, 클릭 시 새 항목 추가 후 모달 닫힘 (원본 불변)
- [ ] 버튼/아이콘: "취소"(및 배경 클릭) — 변경 없이 모달 닫힘

---

## 6. Error Handling

### 6.1 Error Code Definition

서버 API가 관여하지 않으므로 별도 에러 코드가 없다. 유일한 검증은 클라이언트 로컬 검증이다.

| 상황 | 처리 |
|------|------|
| 텍스트가 공백뿐이거나 비어 있음 | "저장"/"새 항목으로 추가" 버튼 비활성화 (기존 `addBeh` 검증과 동일 수준, 별도 에러 메시지 없음) |
| 세션 자동 저장(PUT) 실패 | 기존 `useFocusMap`의 `sessionError` 표시 로직을 그대로 재사용 (신규 처리 없음) |

### 6.2 Error Response Format

해당 없음 (신규 API 없음).

---

## 7. Security Considerations

- [ ] 입력 검증: 텍스트는 trim 후 빈 문자열 여부만 검사 (기존 `addBeh`와 동일 수준, XSS는 React 기본 이스케이프에 의존)
- [ ] 신규 서버 엔드포인트 없음 → 신규 공격 표면 없음
- [ ] 인증/HTTPS/Rate Limiting: 해당 없음 (로컬 단일 사용자 앱, 기존과 동일)

---

## 8. Test Plan

### 8.1 Test Scope

이 프로젝트는 자동화 테스트 도구가 없어 기존 focusmap 기능들과 동일하게 **수동 시나리오 검증**으로 대체한다. 신규 API가 없으므로 L1은 생략한다.

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L2: UI 동작 확인 | §5.4 체크리스트 요소 | 브라우저 수동 조작 (claude-in-chrome 등) | Do |
| L3: E2E 시나리오 | 재작업 후 판정 전환, 분할 추가, 회귀 확인 | 브라우저 수동 조작 | Do/Check |

### 8.2 L1: API Test Scenarios

해당 없음 — 이 기능은 신규/변경 API가 없다.

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|------------------|--------------------|
| 1 | 겹쳐 보기 결과 표 | "쪼개기"/"보류" 행에서 "재작업" 클릭 | 모달 오픈, 텍스트·영향력·능력이 현재 값으로 미리 채워짐 | 모달 입력값 == 해당 item 값 |
| 2 | 재작업 모달 | 텍스트를 비우고 저장/분할 버튼 확인 | 두 버튼 모두 비활성화 | disabled 속성 true |
| 3 | 재작업 모달 | 능력 점수를 4 이상으로 올려 "저장" | 모달 닫힘, 해당 항목만 판정이 "황금 행동"으로 변경, 다른 항목 점수 불변 | 표/플롯에서 해당 항목만 초록색으로 이동 |
| 4 | 재작업 모달 | 텍스트를 더 쉬운 문구로 바꾸고 "새 항목으로 추가" | 모달 닫힘, 원본 항목 그대로 남고 새 항목이 표 끝에 판정된 상태로 추가 | 항목 개수 +1, 원본 텍스트 불변 |
| 5 | 겹쳐 보기 결과 표 | "황금 행동"/"버리기"/이미 "추가됨" 행 확인 | "재작업" 버튼이 나타나지 않음 | 해당 셀 비어 있음 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 쪼개기 항목을 황금 행동으로 전환 | 겹쳐 보기 진입(쪼개기 항목 존재) → 재작업 → 능력 점수만 4로 올려 저장 | 해당 항목 판정이 "황금 행동"으로 바뀌고, 다른 항목 판정·점수는 그대로 |
| 2 | 보류 항목 분할 추가 | 보류 항목 재작업 모달 열기 → 텍스트를 더 쉬운 행동으로 수정 → "새 항목으로 추가" | 원본 보류 항목 유지 + 새 항목이 판정된 상태로 표에 추가됨 |
| 3 | 기존 흐름 회귀 없음 | 재작업 없이 "다시 매기기" 클릭 | 기존과 동일하게 전체 항목 초기화 후 1판부터 재시작 |
| 4 | 추가됨 항목 보호 | 항목을 "할일로 추가" 후 결과 표 확인 | 해당 행에 "재작업" 버튼이 나타나지 않음 |

### 8.5 Seed Data Requirements

없음 — Do/Check 단계에서 기존 목표 세션에 "예시로 채우기"(SEED) 후 1~2판을 진행해 쪼개기/보류 항목을 만들어 수동 검증한다.

---

## 9. Clean Architecture

> 이 프로젝트 규모에 맞춰 4-layer를 단순화해 적용한다.

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Presentation** | 화면 렌더링/이벤트 처리 | `client/src/components/FocusMap/FocusMap.jsx`, `FocusMapReworkModal.jsx` |
| **Application (Hooks)** | 세션 로드·저장 오케스트레이션 | `client/src/hooks/useFocusMap.js` (변경 없음, 그대로 재사용) |
| **Infrastructure** | HTTP 통신 | `client/src/api/focusMap.js` (변경 없음) |
| **Domain** | 판정 로직(`verdictOf`), id 생성(`uid`) | `FocusMap.jsx` 내부 (변경 없음, export만 추가) |

### 9.2 Dependency Rules

```
FocusMapReworkModal(Presentation) ──▶ FocusMap.jsx가 넘겨준 props/콜백만 사용
FocusMapReworkModal은 useFocusMap을 직접 호출하지 않는다 (단방향, 기존 FocusMapList와 동일한 규칙)
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `FocusMap.jsx` | Presentation | `client/src/components/FocusMap/FocusMap.jsx` |
| `FocusMapReworkModal.jsx` | Presentation | `client/src/components/FocusMap/FocusMapReworkModal.jsx` |
| `verdictOf` / `uid` | Domain (기존 유지) | `client/src/components/FocusMap/FocusMap.jsx` |

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

기존 프로젝트 컨벤션을 그대로 따른다: 컴포넌트 PascalCase, 함수 camelCase, 폴더는 기능 단위 PascalCase(`FocusMap/`).

### 10.2 Import Order

기존 파일들의 순서(외부 라이브러리 → 훅/api 상대경로 → 컴포넌트)를 그대로 따른다.

### 10.3 Environment Variables

신규 환경변수 없음.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|---------------------|
| 컴포넌트 분리 기준 | 재사용 가능한 UI 단위(모달)만 분리, 도메인 로직은 기존 파일 위치 유지 — `FocusMapList.jsx` 분리 때와 동일한 기준 |
| 상태 관리 | 로컬 React state + 기존 `update()` 패턴, 전역 스토어 도입 안 함 |
| 저장 시점 | 모달 "저장"/"새 항목으로 추가" 클릭 시점에만 `update()` 호출 (모달 입력 중에는 세션에 반영 안 됨) |

---

## 11. Implementation Guide

### 11.1 File Structure

```
client/src/components/FocusMap/
├── FocusMap.jsx                  (수정 — reworkTargetId 상태, openRework/closeRework/saveRework/addAsSplit 핸들러,
│                                    결과 표 "재작업" 열, IMPACT/ABILITY/verdictOf/uid export)
└── FocusMapReworkModal.jsx       (신규 — 텍스트+점수 편집 모달)
```

### 11.2 Implementation Order

1. [ ] `FocusMap.jsx` — `IMPACT`, `ABILITY`, `verdictOf`, `uid`를 export
2. [ ] `FocusMap.jsx` — `reworkTargetId` state 추가, `openRework`/`closeRework`/`saveRework`/`addAsSplit` 핸들러 구현
3. [ ] `FocusMapReworkModal.jsx` — 신규 작성 (props: `item`, `onSave`, `onAddSplit`, `onCancel`)
4. [ ] `FocusMap.jsx` — 3단계 결과 표에 "재작업" 열 추가 (노출 조건: `verdictOf(it).k`가 `cut`/`hold` && `!addedTaskIds.includes(it.id)`), 모달 조건부 렌더 연결
5. [ ] §8.3~8.4 수동 시나리오 검증

### 11.3 Session Guide

> 변경 범위가 파일 1개 신규 + 1개 수정으로 작아, 세션 분할 없이 단일 Do 세션으로 충분하다.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|--------------|:---:|
| 재작업 모달 + 연동 | `module-1` | `FocusMapReworkModal.jsx` 신규 작성 + `FocusMap.jsx` 상태/핸들러/표 UI 수정 | 12-16 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 (본 문서) |
| Session 2 | Do | `--scope module-1` (또는 스코프 없이 전체) | 12-16 |
| Session 3 | Check + Report | 전체 | 10-15 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-07 | Initial draft (Option C 선택) | Mincoln Cho |
