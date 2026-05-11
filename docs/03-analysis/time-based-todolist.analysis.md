# time-based-todolist Gap Analysis Report

> **Match Rate**: 96%
> **Date**: 2026-05-11
> **Status**: Check Complete (>=90%)

---

## Overall Scores

| 카테고리 | 점수 | 상태 |
|----------|:----:|:----:|
| DB 스키마 | 100% | OK |
| API 엔드포인트 | 100% | OK |
| 컴포넌트 구조 | 100% | OK |
| DnD 설계 | 90% | OK |
| 상태 관리 | 95% | OK |
| 보안 | 95% | OK |
| **전체 Match Rate** | **96%** | **OK** |

---

## 1. DB 스키마 (100%)

설계 문서의 모든 테이블, 컬럼, 제약조건 구현 완료.  
구현에서 추가된 강화 사항:
- `status` CHECK 제약 (`planned/in_progress/done/skipped`)
- `start_hour`/`end_hour` 범위 CHECK
- `created_at` localtime 사용 (설계는 `datetime('now')`)

## 2. API 엔드포인트 (100%)

7개 엔드포인트 전체 구현, 요청/응답 형식 및 에러 코드 일치.

## 3. 컴포넌트 구조 (100%)

7개 컴포넌트 전체 구현, 경로 및 책임 일치.

## 4. DnD 설계 (90%)

### 누락 (GAP)

| 항목 | 설계 | 구현 |
|------|------|------|
| `<Draggable id="schedule-${id}">` | TimeBlock을 드래그하여 백로그로 복귀 | **미구현** — X버튼 클릭으로 대체 |

`App.jsx:43-45`에 `src.type === 'schedule'` 처리 로직은 있으나, `TimeBlock`이 `useDraggable`을 사용하지 않아 이 분기가 실행되지 않음.

### 추가 구현 (설계 초과)

| 항목 | 위치 |
|------|------|
| 빈 슬롯 Droppable (`slot-${hour}`) | `TimeGrid.jsx` |
| `DragOverlay` 시각적 피드백 | `App.jsx` |
| `PointerSensor` 5px 활성화 거리 | `App.jsx` |
| 수기 `+ 시간 블록 추가` 기능 | `App.jsx`, `TimeGrid.jsx` |

## 5. 상태 관리 (95%)

| 항목 | 설계 | 구현 | 영향 |
|------|------|------|------|
| `deleteTask` | 설계명 | `removeTask`로 구현 | Low |
| `updateSchedule` 1개 | 설계 | `changeStatus` + `changeTime` 분리 | Low (더 명확) |

## 6. 보안 (95%)

- prepared statements 전체 사용: OK
- dangerouslySetInnerHTML 미사용: OK
- CORS `localhost:5173` 한정: OK
- `.gitignore` `data/` 포함: 별도 확인 필요

---

## 수정 권장 사항

### 즉시 수정 (Functional Gap)

**`TimeBlock.jsx`에 `useDraggable` 추가**:

```jsx
// TimeBlock.jsx 상단에 추가
import { useDroppable, useDraggable } from '@dnd-kit/core';

// TimeBlock 함수 내에 추가
const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
  id: `schedule-${block.id}`,
  data: { type: 'schedule', scheduleId: block.id, title: block.title },
});
```

`App.jsx:43-45`의 처리 로직은 이미 준비되어 있으므로 `TimeBlock`만 수정하면 완성.

---

## 결론

Match Rate **96%** — 설계와 구현이 전반적으로 잘 일치함.  
단 1개의 Functional Gap(TimeBlock 드래그 복귀)만 수정하면 완전 구현 달성.
