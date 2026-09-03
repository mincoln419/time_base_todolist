# Firebase Firestore 연동 가이드

> 2026-09, SQLite(`node:sqlite`) → Firebase Firestore 마이그레이션. 계획 문서는
> [`docs/01-plan/features/bright-rolling-mist.md`](../01-plan/features/bright-rolling-mist.md)이지만,
> 실제 구현 과정에서 일부 설계가 더 단순한 방향으로 바뀌었다 — 이 문서가 **실제 구현 기준**의 최신 내용이다.

## 왜 바꿨나

기존에는 Express 서버가 Node 내장 `node:sqlite`(`server/db/database.js`)로 로컬 파일(`data/todo.db`)에 직접 접근했다.
사용자가 데이터를 클라우드(Firestore)로 옮기고 싶어 해서 마이그레이션했다. **클라이언트(`client/`)는 전혀 건드리지
않았다** — REST 계약(`/api/...` 경로, 요청/응답 JSON shape, 상태 코드)이 이전과 100% 동일하기 때문에
`client/src/api/*.js`, `hooks/*.js`는 한 줄도 바뀌지 않았다.

## 아키텍처

```
client (Vite, 변경 없음)
  └─ fetch('/api/...')
       └─ Express (server/routes/*.js)
            └─ firebase-admin (서버 전용, 관리자 권한)
                 └─ Firestore
```

- 브라우저에는 Firebase SDK를 노출하지 않는다. Firestore 보안 규칙(`firestore.rules`)은 기본 거부이고,
  서버는 서비스 계정으로 규칙을 우회해 접근한다.
- 앱은 로그인/사용자 구분이 없는 단일 사용자 도구라 Firebase Auth는 도입하지 않았다.

## 설정

리포 루트 `.env`(gitignored)에 다음 두 값이 필요하다:

```
FIREBASE_PROJECT_ID=fir-mermer
FIREBASE_SERVICE_ACCOUNT_PATH=./server/fir-mermer-firebase-adminsdk-xxxxx.json
```

서비스 계정 키는 Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"으로 받는다.
`FIREBASE_SERVICE_ACCOUNT_PATH`는 **리포 루트 기준 상대경로**다. 키 파일 자체는 `.gitignore`에 반드시 추가한다
(이미 추가되어 있음, 파일명은 프로젝트마다 다름).

Firestore Database 자체는 스키마리스라 콘솔에서 별도 스키마 생성이 필요 없다 — 컬렉션은 첫 쓰기 시점에
자동 생성된다. 콘솔의 "앱을 설명해달라"는 AI 스키마 제안 단계는 건너뛰어도 된다.

`server/db/firestore.js`가 `firebase-admin`을 초기화하는 유일한 지점이다. firebase-admin v14는 모듈형
API라 `require('firebase-admin')`에는 앱 초기화 함수만 있고, `firestore()`/`credential.cert()`는
`firebase-admin/app`, `firebase-admin/firestore` 서브패스에서 가져와야 한다.

## 데이터 모델

계획 문서는 부모-자식 관계(tickets, subgoals, requirements, member tasks, meeting item들)를 전부
Firestore 서브컬렉션으로 설계했지만, **실제로는 대부분 최상위 컬렉션 + SQLite 시절 FK 필드 그대로**로
구현했다. 이유: 이 리소스들의 수정/삭제 라우트가 부모 id 없이 자기 id만으로 접근하기 때문이다
(예: `PATCH /api/tickets/:id`, `PATCH /api/longgoals/subgoals/:id`). 서브컬렉션으로 만들면 매번
`collectionGroup` 쿼리 + 별도 필드 인덱스 설정이 필요해져 불필요하게 복잡해진다.

| SQLite 테이블 | Firestore 컬렉션 | 비고 |
|---|---|---|
| tasks | `tasks` | |
| schedules | `schedules` | + `scheduleSlots/{date}__{start_min}` 센티널 문서로 UNIQUE(date,start_min) 재현 |
| focus_map | `focusMap` | `data` TEXT(JSON 문자열) → 네이티브 map 필드 |
| notification_webhooks | `notificationWebhooks` | |
| customers | `customers` | |
| tickets | `tickets` (top-level) | `customer_id` 필드 + 비정규화된 `customer_name`(GET 목록 전용, 다른 응답에서는 제외) |
| unconscious_worries | `worries` | |
| unconscious_worry_attempts | `worries/{id}/attempts/{date}` (서브컬렉션) | 유일하게 서브컬렉션 — 모든 라우트가 항상 worry id를 경로에 포함하므로 예외적으로 이 구조가 더 단순함. 문서 ID를 `date`로 써서 복합키(worry_id,date) upsert를 그대로 재현 |
| long_goals | `longGoals` | |
| long_goal_subgoals/requirements/rewards | `longGoalSubgoals`/`longGoalRequirements`/`longGoalRewards` (top-level) | `goal_id` 필드 |
| bucket_list_items | `bucketListItems` | goal_id 없음, 원래도 독립 |
| warroom_rails | `warroomRails` | |
| warroom_members | `warroomMembers` | `rail_id` nullable(미배치 로스터) |
| warroom_member_tasks | `warroomMemberTasks` (top-level) | `member_id` 필드 |
| daily_notes | `dailyNotes` | `month`(=date.slice(0,7)) 필드 추가 — SQL `LIKE 'YYYY-MM%'` 대체 |
| meetings | `meetings` | |
| meeting_overall/part/action_items | `meetingOverallItems`/`meetingPartItems`/`meetingActionItems` (top-level) | `meeting_id` 필드 |

컬렉션 이름과 `_counters` 카운터 키는 `server/db/collections.js`에 상수로 모여 있다.

## 핵심 설계 원칙

1. **원래 SQLite 정수 id를 그대로 필드로 저장**하고, Firestore 문서 ID는 `String(id)`로 둔다. 응답 JSON은
   `doc.data()`에서 만들어지므로 `"id": 42`(숫자) 형태가 그대로 유지된다. FK도 문자열 변환 없이 원래 정수
   그대로 저장한다(예: `goal_id: 3`).
2. **타임스탬프는 Firestore `Timestamp`가 아니라 SQLite와 동일한 문자열**(`"2026-09-03 01:22:39"`, 로컬
   타임)로 저장한다 — `server/db/util.js`의 `nowString()`. 문자열 정렬이 곧 시간 정렬이라 `orderBy`도
   그대로 동작한다.
3. **새 id는 `_counters/{counterKey}` 문서를 트랜잭션으로 증가시켜 발급**한다(`nextId`/`nextIds`,
   `server/db/util.js`). SQLite AUTOINCREMENT처럼 삭제된 id를 재사용하지 않는다. 한 트랜잭션 안에서 같은
   카운터로 여러 개를 발급해야 하면(예: 회의록 액션아이템 AI 일괄 생성) 반드시 `nextIds(tx, key, count)`를
   써야 한다 — `nextId`를 여러 번 부르면 이미 쓴 문서를 다시 읽으려다 Firestore 트랜잭션 예외가 난다.

## 까다로운 SQL 패턴을 Firestore로 옮긴 방법

- **position MAX+1 (정렬용 순번)**: 트랜잭션 안에서 `orderBy('position','desc').limit(1)`로 최댓값 조회 후 +1.
- **UNIQUE(date,start_min)** (`schedules.js`): `scheduleSlots/{date}__{start_min}` 센티널 문서에
  `tx.create()` — 이미 있으면 예외를 던지므로 그대로 409로 매핑.
- **goal 중복 체크** (`focusmap.js`): 트랜잭션 내 `where('goal','==',goal)` 조회.
- **CASCADE 삭제**: 최상위 컬렉션이므로 `firestore.recursiveDelete()`를 쓸 수 없다 —
  `where('<부모>_id','==',id)`로 자식을 조회해 `batch`로 함께 삭제한다 (customers→tickets,
  longGoals→subgoals/requirements/rewards, meetings→각 item, warroomMembers→tasks).
- **ON DELETE SET NULL** (레일 삭제 시 배치된 인원): `where('rail_id','==',railId)` 조회 후 각 문서
  `rail_id: null`로 batch update + 레일 삭제.
- **복합키 upsert** (`worries/{id}/attempts/{date}`): 문서 ID가 이미 `date`라서 존재 확인 후 set/update만
  하면 된다. `attempted=0`은 그냥 문서 삭제.
- **nulls-last 정렬** (`tickets.desired_date`): Firestore 쿼리로 표현 불가 — 전체 조회 후 JS에서 정렬
  (데이터 양이 적어 문제 없음).
- **스케줄러 guarded update** (`scheduler.js`): SQL의 `UPDATE ... WHERE status='planned'` 가드를
  `runTransaction`으로 재현 — 읽어서 상태 재확인 후에만 업데이트.
- **워룸 primary task 단일성**: 트랜잭션 안에서 `where('member_id','==',id)`로 형제 문서를 모두 읽어
  대상 외에는 `is_primary:0`으로 클리어한 뒤 대상만 세팅.
- **레일 position swap**: 이웃 레일을 쿼리로 찾은 뒤, 트랜잭션 안에서 두 문서를 다시 읽어 position을
  맞바꾼다.

## 인덱스 관리

컬렉션에 `where` + `orderBy`(다른 필드) 조합이나 2개 이상의 `orderBy`가 있으면 Firestore 컴포지트 인덱스가
필요하다. 이 프로젝트의 인덱스는 리포 루트 `firestore.indexes.json`에 코드로 정의되어 있고,
`firestore.rules`/`firebase.json`과 함께 다음 명령으로 배포한다:

```bash
firebase deploy --only firestore:indexes,firestore:rules --project fir-mermer
```

**주의**: composite index의 정렬 방향은 실제 쿼리와 정확히 일치해야 한다 (`orderBy('position','desc')`를
쓰는데 인덱스를 ASCENDING으로 만들면 매칭되지 않는다). 인덱스 빌드는 몇 초~몇 분 걸릴 수 있고, 빌드 중에는
해당 쿼리가 `FAILED_PRECONDITION`(코드 9)로 실패한다. 빌드 상태는 아래 스크립트로 확인 가능:

```js
const { FirestoreAdminClient } = require('@google-cloud/firestore').v1;
const client = new FirestoreAdminClient({ keyFilename: '<서비스 계정 키 경로>' });
const [indexes] = await client.listIndexes({
  parent: `projects/${projectId}/databases/(default)/collectionGroups/-`,
});
// idx.state === 'READY' 확인
```

`worries/attempts`처럼 서브컬렉션에 `collectionGroup()` 쿼리를 쓰는 필드는 컴포지트 인덱스가 아니라
`fieldOverrides`(단일 필드를 COLLECTION_GROUP 스코프로 확장)가 필요하다 — `firestore.indexes.json`의
`fieldOverrides` 섹션 참고.

## 마이그레이션 스크립트

- `server/scripts/migrate-to-firestore.js` — 1회성 실행용. `db/database.js`(기존 SQLite 연결)를 그대로
  `require`해서 읽으므로, 그 모듈이 부팅 시 적용하는 ad-hoc 백필(예: `daily_notes.related_keywords` 병합)이
  이미 반영된 "최종 형태"로 데이터를 읽는다. 실행: `node server/scripts/migrate-to-firestore.js`
  (repo root `.env`를 직접 로드하므로 `server/` 안에서 실행).
- `server/scripts/verify-migration.js` — SQLite row count vs Firestore 문서 수, 샘플 3건 필드 대조.
  실행: `node server/scripts/verify-migration.js`. 모든 테이블이 `OK`면 통과.
- 두 스크립트 모두 **덮어쓰기(set)** 방식이라 다시 실행해도 안전하다(멱등).

## 백업/복원 (`/api/backup`)

`server/routes/backup.js`는 원래 SQLite 테이블 이름을 JSON 키로 그대로 쓴다(기존에 내려받은 백업 파일과의
호환성 때문). 내부적으로는 `SIMPLE_TABLES` 매핑으로 Firestore 컬렉션에 연결하고,
`unconscious_worry_attempts`만 서브컬렉션이라 별도 처리한다. Import 시 `tickets`의 `customer_name`은
함께 들어온 `customers` 데이터로부터 다시 계산해서 채운다.

## 레거시 코드

`server/db/database.js`, `server/db/schema.sql`, 원본 `data/todo.db`는 롤백 대비로 아직 남아 있다
(마이그레이션 스크립트가 `database.js`를 계속 참조하므로 완전히 지우지 않았다). 운영이 안정된 후 제거할
계획 — 지우기 전에 `data/todo.db`를 리포 밖에 별도 보관할 것.

## 새 리소스를 추가할 때

1. `server/db/collections.js`에 컬렉션 이름 + `_counters` 키 추가.
2. 라우트 파일에서 `nowString()`/`nextId()`/`asyncHandler`(`server/db/util.js`)를 그대로 재사용.
3. 부모 id 없이 자기 id만으로 접근하는 자식 리소스라면 서브컬렉션 대신 최상위 컬렉션 + `<부모>_id` 필드로
   설계한다(위 "데이터 모델" 참고).
4. `where`+`orderBy` 조합을 새로 쓰면 로컬에서 한 번 호출해보고, 에러 메시지의 콘솔 링크로 안내되는 인덱스를
   `firestore.indexes.json`에 옮겨 적은 뒤 `firebase deploy --only firestore:indexes`로 배포한다.
