// migrate-to-firestore.js 실행 후 검증: SQLite 테이블별 row count와 Firestore 컬렉션
// 문서 수를 독립적으로 비교하고, 테이블마다 샘플 몇 건을 필드 단위로 대조한다.
// 실행: node server/scripts/verify-migration.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const db = require('../db/database');
const { firestore } = require('../db/firestore');
const {
  TASKS, SCHEDULES, FOCUS_MAP, NOTIFICATION_WEBHOOKS, CUSTOMERS, TICKETS,
  WORRIES, WORRY_ATTEMPTS, LONG_GOALS, LONG_GOAL_SUBGOALS, LONG_GOAL_REQUIREMENTS, LONG_GOAL_REWARDS,
  BUCKET_LIST_ITEMS, WARROOM_RAILS, WARROOM_MEMBERS, WARROOM_MEMBER_TASKS, DAILY_NOTES,
  MEETINGS, MEETING_OVERALL_ITEMS, MEETING_PART_ITEMS, MEETING_ACTION_ITEMS,
} = require('../db/collections');

const TABLE_TO_COLLECTION = {
  tasks: TASKS,
  schedules: SCHEDULES,
  focus_map: FOCUS_MAP,
  notification_webhooks: NOTIFICATION_WEBHOOKS,
  customers: CUSTOMERS,
  tickets: TICKETS,
  unconscious_worries: WORRIES,
  long_goals: LONG_GOALS,
  long_goal_subgoals: LONG_GOAL_SUBGOALS,
  long_goal_requirements: LONG_GOAL_REQUIREMENTS,
  long_goal_rewards: LONG_GOAL_REWARDS,
  bucket_list_items: BUCKET_LIST_ITEMS,
  warroom_rails: WARROOM_RAILS,
  warroom_members: WARROOM_MEMBERS,
  warroom_member_tasks: WARROOM_MEMBER_TASKS,
  daily_notes: DAILY_NOTES,
  meetings: MEETINGS,
  meeting_overall_items: MEETING_OVERALL_ITEMS,
  meeting_part_items: MEETING_PART_ITEMS,
  meeting_action_items: MEETING_ACTION_ITEMS,
};

function pick(row, keys) {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}

async function verifySimpleTable(table) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  const collection = firestore.collection(TABLE_TO_COLLECTION[table]);
  const countSnap = await collection.count().get();
  const firestoreCount = countSnap.data().count;

  const mismatches = [];
  const sample = rows.slice(0, 3);
  for (const row of sample) {
    const doc = (await collection.doc(String(row.id)).get()).data();
    if (!doc) { mismatches.push(`id=${row.id} 문서 없음`); continue; }
    const keys = Object.keys(row).filter((k) => k !== 'data'); // focus_map.data는 별도 처리
    for (const k of keys) {
      if (String(doc[k] ?? '') !== String(row[k] ?? '')) {
        mismatches.push(`id=${row.id} 필드 ${k}: sqlite=${row[k]} firestore=${doc[k]}`);
      }
    }
  }

  return { sqliteCount: rows.length, firestoreCount, mismatches };
}

async function verifyWorryAttempts() {
  const rows = db.prepare('SELECT * FROM unconscious_worry_attempts').all();
  const snap = await firestore.collectionGroup(WORRY_ATTEMPTS).get();
  const mismatches = [];
  for (const row of rows.slice(0, 3)) {
    const doc = (
      await firestore.collection(WORRIES).doc(String(row.worry_id)).collection(WORRY_ATTEMPTS).doc(row.date).get()
    ).data();
    if (!doc) mismatches.push(`worry_id=${row.worry_id} date=${row.date} 문서 없음`);
    else if (doc.attempted !== row.attempted) mismatches.push(`worry_id=${row.worry_id} date=${row.date} attempted 불일치`);
  }
  return { sqliteCount: rows.length, firestoreCount: snap.size, mismatches };
}

async function verifyFocusMap() {
  const rows = db.prepare('SELECT * FROM focus_map').all();
  const countSnap = await firestore.collection(FOCUS_MAP).count().get();
  const mismatches = [];
  for (const row of rows.slice(0, 3)) {
    const doc = (await firestore.collection(FOCUS_MAP).doc(String(row.id)).get()).data();
    const expected = JSON.parse(row.data);
    if (!doc) { mismatches.push(`id=${row.id} 문서 없음`); continue; }
    if (JSON.stringify(doc.data) !== JSON.stringify(expected)) mismatches.push(`id=${row.id} data 불일치`);
  }
  return { sqliteCount: rows.length, firestoreCount: countSnap.data().count, mismatches };
}

async function main() {
  const results = {};
  for (const table of Object.keys(TABLE_TO_COLLECTION)) {
    if (table === 'focus_map') { results[table] = await verifyFocusMap(); continue; }
    results[table] = await verifySimpleTable(table);
  }
  results.unconscious_worry_attempts = await verifyWorryAttempts();

  console.log('\n=== 검증 결과 ===');
  let allOk = true;
  for (const [table, r] of Object.entries(results)) {
    const countOk = r.sqliteCount === r.firestoreCount;
    const sampleOk = r.mismatches.length === 0;
    if (!countOk || !sampleOk) allOk = false;
    console.log(
      `${table.padEnd(28)} count sqlite=${r.sqliteCount} firestore=${r.firestoreCount} ${countOk ? 'OK' : 'MISMATCH'}` +
      (sampleOk ? '' : `  sample-mismatches=${JSON.stringify(r.mismatches)}`)
    );
  }
  console.log(allOk ? '\n모든 테이블 검증 통과' : '\n일부 불일치 있음 — 위 로그 확인');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error('검증 실패:', e);
  process.exit(1);
});
