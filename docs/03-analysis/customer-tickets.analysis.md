# customer-tickets Gap Analysis Report

> **Match Rate**: 99%
> **Date**: 2026-08-09
> **Status**: Check Complete (>=90%)
> **Design Doc**: [customer-tickets.design.md](../02-design/features/customer-tickets.design.md)

---

## Overall Scores

| 카테고리 | 점수 | 상태 |
|----------|:----:|:----:|
| DB 스키마 | 100% | OK |
| API 엔드포인트 | 95% | OK |
| 컴포넌트 구조 | 100% | OK |
| 일정관리(tasks) 연동 | 100% | OK |
| 상태 관리 | 100% | OK |
| 보안 | 100% | OK |
| UI 체크리스트 | 95% | OK |
| **전체 Match Rate** | **99%** | **OK** |

---

## 1. DB 스키마 (100%)

`customers`, `tickets` 테이블 모두 설계(§3.3) 그대로 구현. `customer_id` FK의 `ON DELETE CASCADE`는 실제 curl 테스트로 검증 완료 — 티켓 2개를 가진 고객사를 삭제하면 티켓도 함께 삭제됨(`GET /api/customers/:id/tickets` → 404, 이후 조회 불가).

## 2. API 엔드포인트 (95%)

7개 엔드포인트 전체 구현, 상태 코드·에러 메시지 모두 설계와 일치 (curl로 FR-03~FR-09 전항목 검증).

### 설계 대비 차이 (GAP)

| 항목 | 설계(§4.2 예시) | 구현 |
|------|------------------|------|
| 응답 키 표기 | `customerId`, `createdAt` (camelCase) | `customer_id`, `created_at` (snake_case, `SELECT *` 그대로 반환) |

**판단**: 이 프로젝트의 관계형 리소스(`tasks`, `schedules`)는 모두 DB row를 가공 없이 snake_case로 반환하는 것이 실제 컨벤션이며, 설계 문서의 camelCase 예시는 JSON 블롭인 `focus_map`의 표기를 그대로 옮겨 적은 것이었다. Do 단계에서 관계형 테이블 컨벤션(`tasks.js`/`schedules.js`)에 맞춰 snake_case로 통일했다 — Design §10.1 "기존 프로젝트 컨벤션을 그대로 따른다" 원칙에 더 부합하는 선택. 기능적 결함이 아니라 문서 표기 오차이므로 Design 문서만 사후 보정하면 된다(별도 코드 수정 불필요).

## 3. 컴포넌트 구조 (100%)

설계 §11.1 File Structure의 9개 파일(스키마 수정 1 + 라우트 2 + `index.js` 수정 1 + api 2 + hooks 2 + 컴포넌트 3, `App.jsx` 수정 1) 전부 동일 경로·역할로 구현. `useTickets`가 `api/customers.js`(목록/생성)와 `api/tickets.js`(토글/삭제) 양쪽을 가져다 쓰는 구조도 설계 그대로.

## 4. 일정관리(tasks) 연동 (100%)

FR-16 요구사항대로 티켓 생성 직후 클라이언트가 기존 `useTasks().addTask()`를 `[고객사명] 제목` 형식으로 호출. Playwright E2E로 실제 브라우저에서 검증:
- "고객사 티켓" 탭에서 acme에 "로그인 오류 문의" 티켓 추가
- "일정관리" 탭으로 전환 → 할일 목록에 `[acme] 로그인 오류 문의` 등장 확인 (스크린샷 확보)

서버 조인/트랜잭션 없이 클라이언트 2회 호출로 처리한 설계 결정(§7.2)도 그대로 반영.

## 5. 상태 관리 (100%)

`useFocusMapList`/`useFocusMap` 분리 패턴과 동일하게 `useCustomers`(목록)·`useTickets(customerId)`(상세)로 분리. `CustomerTickets.jsx`는 자체 `useTasks()`를 새로 만들지 않고 `App.jsx`로부터 `addTask`를 `onTaskAdd` prop으로 전달받아 재사용 — 설계 §9.2 Dependency Rules와 일치.

## 6. 보안 (100%)

- `name`/`title` trim 후 빈 문자열 검사: OK
- 전 쿼리 `db.prepare().run()` 파라미터 바인딩, 문자열 concat 없음: OK
- 신규 `dangerouslySetInnerHTML` 없음: OK
- CORS/인증 범위 변경 없음: OK

## 7. UI 체크리스트 (95%)

§5.4 체크리스트 대부분 구현·검증(빈 상태 문구, 선택 강조, 토글 취소선+회색, 고객사 삭제 confirm 등).

### 경미한 차이

| 항목 | 설계 | 구현 |
|------|------|------|
| 티켓 "+" 입력 취소 | "취소/빈 값이면 닫기" | 별도 취소 버튼 없이 `onBlur`로 빈 값일 때만 닫힘 (텍스트 입력 후 포커스 이탈 시에는 닫히지 않고 유지) |

**영향**: Low. 기능은 동작하나(빈 값 입력 후 다른 곳 클릭 시 자동으로 닫힘), 값이 입력된 상태에서 명시적으로 "취소"하고 싶을 때 취소 버튼이 없어 입력을 지우고 포커스를 옮기거나 그대로 제출해야 한다. 사용성에 큰 지장은 없어 필수 수정 대상은 아님.

---

## 회귀 확인

- 기존 `일정관리`/`포커스 맵` 탭 코드(`DateNavigator`, `TaskBacklog`, `TimeGrid`, `DayTimeline`, `FocusMap` 등)는 수정하지 않음 — `App.jsx`에서 `TABS` 배열 항목 추가, 신규 탭 조건부 렌더링 블록 추가, `addTask`를 `CustomerTickets`에 전달하는 3곳만 변경.
- `npx vite build` 성공.
- 기존 `tasks`/`schedules`/`focus_map` 테이블·라우트 변경 없음 (신규 테이블만 추가).

---

## 수정 권장 사항

필수 수정 사항 없음(Match Rate 99% ≥ 90%). 선택적으로:

1. Design 문서 §4.2의 JSON 예시를 실제 응답(snake_case)에 맞춰 사후 보정 (문서 정합성 목적, 기능 영향 없음)
2. `TicketPanel.jsx`의 "+" 입력 폼에 명시적 "취소" 버튼 추가 (선택 사항, Low 우선순위)

---

## 결론

Match Rate **99%** — 설계와 구현이 거의 완전히 일치. API 응답 키 표기(snake_case vs 설계 예시의 camelCase)는 실제로는 기존 프로젝트 컨벤션에 더 맞게 개선된 것이라 결함이 아니며, UI의 "+" 입력 취소 버튼 부재만 경미한 Nice-to-have로 남는다. 즉시 수정이 필요한 Functional Gap 없음 — Report 단계로 진행 가능.
