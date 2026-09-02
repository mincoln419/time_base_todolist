# SQLite → Firebase(Firestore) 마이그레이션 계획

## Context

`time_base_todolist`는 지금까지 Node `node:sqlite`(`server/db/database.js`, `better-sqlite3`가 아님) 기반으로 21개 테이블에 걸쳐 할일/스케줄/데일리노트/회의록/장기목표/워룸보드/고객티켓/무의식걱정/버킷리스트/웹훅 데이터를 저장해왔다. 사용자가 잘 쓰고 있는 앱을 계속 발전시키기 위해 DB를 Firebase Firestore로 옮기고 싶어 함. 실사용 데이터(`data/todo.db`, ~3.1MB)가 존재하므로 1회성 마이그레이션이 필요하고, Firebase 프로젝트(`fir-mermer`)와 자격증명은 이미 준비됨.

**핵심 결정(사용자 확인 완료)**

- Express 서버 계층은 그대로 유지하고 **DB 접근 계층만 Firestore로 교체**한다. 클라이언트(`client/src/api/*.js`, `hooks/*.js`)는 REST 계약(경로/요청/응답 shape)이 동일하게 유지되므로 **전혀 수정하지 않는다**.
- 서버는 `firebase-admin`(서비스 계정, 관리자 권한)으로 Firestore에 접근한다. 브라우저에는 Firebase SDK를 노출하지 않는다 — 사용자가 공유한 웹 SDK config(`fir-mermer` project)는 이 아키텍처에서 사용하지 않음.
- 앱은 로그인/사용자 구분이 없는 단일 사용자용 도구이므로 Firebase Auth는 도입하지 않고, Firestore 보안 규칙은 기본 거부(서버만 admin SDK로 접근)로 둔다.
- 개발 단계(마이그레이션 전, 1~10단계)는 실제 Firestore 프로젝트에 직접 작업한다 — 마이그레이션(11단계) 전까지는 실데이터가 없으므로 에뮬레이터 없이도 안전하고, 개인 프로젝트 규모라 쿼터 걱정도 없다. 세팅 단순화를 위한 선택.

## Firebase 콘솔 설정 (사용자 액션)

- Firestore Database 생성 화면에서 나오는 "앱을 설명해달라"는 AI 스키마 제안은 **건너뛰어도 된다** — Firestore는 스키마리스라 컬렉션은 마이그레이션 스크립트가 처음 쓸 때 자동 생성된다. 리전만 고르고 프로덕션 모드로 빈 DB를 만들면 충분.
- 서버에는 **서비스 계정 키(JSON)**가 필요: 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성". 파일은 `<repo-root>/credentials/firebase-service-account.json`에 두고 `.gitignore`에 추가(코드 작업 시 자동으로 처리). 내용은 채팅에 붙여넣지 않는다.
- `.env`(repo root, gitignored)에 추가:
  ```
  FIREBASE_PROJECT_ID=fir-mermer
  FIREBASE_SERVICE_ACCOUNT_PATH=./credentials/firebase-service-account.json
  ```

## 데이터 모델 설계 원칙

1. **모든 문서는 원래 SQLite 정수 `id`를 그대로 필드로 저장**하고, Firestore 문서 ID는 `String(id)`로 둔다. 응답 JSON은 `doc.data()`에서 만들어지므로 `"id": 42`(숫자) 형태가 그대로 유지되어 클라이언트가 영향받지 않는다. FK(`goal_id`, `meeting_id` 등)도 문자열 변환한 원래 ID를 그대로 참조에 쓴다 — 별도 ID 매핑 테이블 불필요.
2. **타임스탬프는 Firestore `Timestamp`가 아니라 SQLite와 동일한 문자열 포맷**(`"2026-09-02 22:24:10"`)을 쓰는 `nowString()` 헬퍼로 저장 — 응답 shape을 그대로 유지하고 문자열 정렬도 `created_at` 기준 정렬과 호환된다.
3. **새 ID는 `_counters/{table}` 컬렉션의 트랜잭션 증가값**으로 발급(MAX+1 대신) — 삭제된 ID 재사용 방지, SQLite AUTOINCREMENT와 동일한 특성 유지.

## 컬렉션 설계 (21개 테이블 → Firestore)

| SQLite 테이블                           | Firestore 위치                                             | 비고                                                               |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| tasks                                   | `tasks` (top-level)                                        |                                                                    |
| schedules                               | `schedules` + 센티널 `scheduleSlots/{date}__{start_min}`   | UNIQUE(date,start_min) 제약용                                      |
| focus_map                               | `focusMap`                                                 | `data`는 JSON 문자열이 아니라 네이티브 map 필드로                  |
| notification_webhooks                   | `notificationWebhooks`                                     |                                                                    |
| customers                               | `customers`                                                |                                                                    |
| tickets                                 | `customers/{id}/tickets` (subcollection)                   | `customer_name` 비정규화, 전체 목록은 `collectionGroup('tickets')` |
| unconscious_worries                     | `worries`                                                  |                                                                    |
| unconscious_worry_attempts              | `worries/{id}/attempts`, 문서ID=`date`                     | 복합키(worry_id,date) upsert가 단순 트랜잭션이 됨                  |
| long_goals                              | `longGoals`                                                |                                                                    |
| long_goal_subgoals/requirements/rewards | `longGoals/{id}/subgoals`, `/requirements`, `/rewards`     |                                                                    |
| warroom_rails                           | `warroomRails`                                             |                                                                    |
| warroom_members                         | `warroomMembers` (top-level, subcollection 아님)           | `rail_id` nullable(미배정 로스터)이라 subcollection 부적합         |
| warroom_member_tasks                    | `warroomMembers/{id}/tasks`                                |                                                                    |
| daily_notes                             | `dailyNotes`                                               | `month`(=date.slice(0,7)) 필드 비정규화, LIKE 'YYYY-MM%' 대체      |
| meetings                                | `meetings`                                                 |                                                                    |
| meeting_overall/part/action_items       | `meetings/{id}/overallItems`, `/partItems`, `/actionItems` |                                                                    |
| bucket_list_items                       | `bucketListItems` (top-level)                              | goal_id 없음, 원래도 독립 테이블                                   |

## 까다로운 SQL 패턴 → Firestore 해법 (요약)

- **position MAX+1**: `runTransaction` 안에서 `orderBy('position','desc').limit(1)` 조회 + `_counters`로 id 발급.
- **UNIQUE(date,start_min)**: `scheduleSlots/{date}__{start_min}` 센티널 문서에 `tx.create()`(이미 있으면 예외) → 409 매핑.
- **focus_map goal 중복 체크**: 트랜잭션 내 `where('goal','==',goal)` 조회 후 판단.
- **CASCADE 삭제**: `firestore.recursiveDelete(ref)` (customers→tickets, longGoals→하위, meetings→하위, warroomMembers→tasks).
- **ON DELETE SET NULL** (rail→members): batch로 `where('rail_id','==',railId)` 조회 후 각 문서 `rail_id: null` 업데이트 + rail 삭제.
- **복합키 upsert (worry attempts)**: `worries/{id}/attempts/{date}` 문서에 대해 존재 확인 후 set/update, `attempted=0`은 그냥 delete.
- **nulls-last 정렬 (tickets.desired_date)**: 전체 조회 후 JS에서 정렬(데이터 양이 적어 문제 없음).
- **LIKE 월 필터 (daily_notes)**: `month` 필드 equality 쿼리.
- **worries daily/stats substr 로직**: 데이터 양이 적으므로 전체 로드 후 기존 JS predicate 그대로 재사용, attempts는 `collectionGroup('attempts')`.
- **스케줄러 guarded update**: `runTransaction`으로 상태가 여전히 'planned'인지 확인 후 업데이트(경쟁 조건 방지, 기존 `changes===0` 체크와 동등).
- **워룸 primary task 단일성**: subcollection이라 `member_id` 필터 불필요, 트랜잭션으로 형제 문서들의 `is_primary` 클리어 후 대상만 설정.
- **레일 position swap**: 기존과 동일하게 `runTransaction`으로 두 문서 position 교환.

## 파일 변경 목록

**신규**

- `server/db/firestore.js` — firebase-admin 싱글턴 초기화
- `server/db/collections.js` — 컬렉션 이름 상수
- `server/db/util.js` — `nowString()`, `nextId(tx, name)`, `NotFoundError`/`ConflictError`
- `server/scripts/migrate-to-firestore.js` — 1회성 마이그레이션
- `server/scripts/verify-migration.js` — 카운트/샘플 검증
- `firebase.json`, `firestore.indexes.json`, `firestore.rules` (repo root)
- `.gitignore`에 `credentials/` 추가

**DB 접근 로직만 재작성 (라우트 경로/응답 shape 불변)**

- `server/routes/tasks.js`, `schedules.js`, `focusmap.js`, `customers.js`, `tickets.js`, `worries.js`, `longgoals.js`, `warroom.js`, `dailyNotes.js`, `webhooks.js`, `meetings.js`, `backup.js`
- `server/services/notifications.js`, `server/scheduler.js`
- `server/package.json`(firebase-admin 추가), `server/.env.example`(FIREBASE\_\* 문서화)

**변경 없음**: `server/routes/notify.js`, `server/services/meetingAi.js`, `client/` 전체

**최종 정리 단계에서 제거**: `server/db/database.js`, `server/db/schema.sql`(또는 참고용으로 이동), `node:sqlite` 관련 코드

## 진행 순서 (각 단계마다 curl/클라이언트로 검증 후 다음 단계)

1. 인프라: `firebase-admin` 설치, `db/firestore.js`/`collections.js`/`util.js`, 연결 테스트(테스트 문서 쓰기/읽기)
2. 단순 flat 테이블: `tasks.js`, `webhooks.js`
3. UNIQUE 제약 테이블: `schedules.js`(센티널), `focusmap.js`(트랜잭션 중복체크)
4. 부모/자식 + cascade: `customers.js` + `tickets.js` (subcollection, collectionGroup, recursiveDelete)
5. 복합키 + range 쿼리: `worries.js`
6. 다중 하위 컬렉션 집계: `longgoals.js`, `meetings.js`
7. 트랜잭션 최다: `warroom.js`
8. 날짜 필터링: `dailyNotes.js`
9. `scheduler.js` (schedules.js 검증 완료 후)
10. `backup.js` Firestore 기반 재작성 (마이그레이션 스크립트가 이 로직 재사용)
11. `server/scripts/migrate-to-firestore.js` 작성 + 실제 `data/todo.db` 대상 1회 실행 + `verify-migration.js`로 검증
12. 최종 정리: `db/database.js`/`schema.sql` 제거, `.env.example` 갱신, 원본 `data/todo.db`는 백업으로 리포 밖에 보관

## 검증 방법 (테스트 스위트 없음 — curl 기반 수동 비교)

- 라우트 변경 전/후로 동일한 `curl` 호출(성공/에러 케이스 포함: 스케줄 409, focusmap 중복 409, cascade 삭제, 워룸 rail 삭제 시 member.rail_id=null, primary task 단일성, tickets nulls-last 정렬, dailyNotes 월 필터, worries 날짜 경계)을 실행해 status code와 JSON body(특히 필드 타입: number vs string)가 동일한지 비교.
- 이미 떠 있는 클라이언트(Vite)로 각 화면을 직접 조작해 콘솔 에러/동작 이상 여부 확인 — hooks/api가 안 바뀌므로 shape 불일치가 있으면 바로 드러남.
- 마이그레이션 후: 테이블별 row count(SQLite) vs 컬렉션 `.count().get()`(Firestore) 비교 + 테이블/서브컬렉션당 샘플 3~5건 필드 단위 비교(널 필드 케이스 포함).

## 실행 방식

이 마이그레이션은 13개 이상의 파일을 건드리는 큰 작업이라, 위 순서대로 단계별로 구현하고 각 단계 후 curl/클라이언트로 확인하며 진행한다. 한 번에 전부 끝내기보다 단계마다 결과를 보고하고 다음 단계로 넘어간다.
