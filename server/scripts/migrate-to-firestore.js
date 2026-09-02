// 1회성 마이그레이션: 기존 SQLite(data/todo.db) 실데이터를 Firestore로 옮긴다.
// 실행: node server/scripts/migrate-to-firestore.js
//
// db/database.js를 그대로 require해서 읽는다 — 이 모듈은 로드 시점에 daily_notes의
// related_keywords 병합 등 기존 ad-hoc 마이그레이션을 이미 적용해두므로, SQLite 쪽 데이터가
// "최종 형태"인 상태에서 읽게 된다(중복 구현 불필요).
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const db = require('../db/database');
const { firestore } = require('../db/firestore');
const {
  TASKS, SCHEDULES, SCHEDULE_SLOTS, FOCUS_MAP, NOTIFICATION_WEBHOOKS, CUSTOMERS, TICKETS,
  WORRIES, WORRY_ATTEMPTS, LONG_GOALS, LONG_GOAL_SUBGOALS, LONG_GOAL_REQUIREMENTS, LONG_GOAL_REWARDS,
  BUCKET_LIST_ITEMS, WARROOM_RAILS, WARROOM_MEMBERS, WARROOM_MEMBER_TASKS, DAILY_NOTES,
  MEETINGS, MEETING_OVERALL_ITEMS, MEETING_PART_ITEMS, MEETING_ACTION_ITEMS, COUNTERS, COUNTER_KEYS,
} = require('../db/collections');

function allRows(table) {
  return db.prepare(`SELECT * FROM ${table}`).all();
}

async function writeSimpleTable(sqlTable, collectionName, counterKey, transform = (row) => row) {
  const rows = allRows(sqlTable);
  const writer = firestore.bulkWriter();
  let maxId = 0;
  for (const row of rows) {
    const doc = transform(row);
    writer.set(firestore.collection(collectionName).doc(String(doc.id)), doc);
    if (doc.id > maxId) maxId = doc.id;
  }
  await writer.close();
  if (counterKey) {
    await firestore.collection(COUNTERS).doc(counterKey).set({ value: maxId });
  }
  return { sqliteCount: rows.length, firestoreWriteCount: rows.length };
}

async function migrateTickets() {
  const customers = allRows('customers');
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  return writeSimpleTable('tickets', TICKETS, COUNTER_KEYS.TICKETS, (row) => ({
    ...row,
    customer_name: nameById.get(row.customer_id) ?? null,
  }));
}

async function migrateFocusMap() {
  return writeSimpleTable('focus_map', FOCUS_MAP, COUNTER_KEYS.FOCUS_MAP, (row) => ({
    id: row.id,
    goal: row.goal,
    data: JSON.parse(row.data),
    updated_at: row.updated_at,
  }));
}

async function migrateDailyNotes() {
  return writeSimpleTable('daily_notes', DAILY_NOTES, COUNTER_KEYS.DAILY_NOTES, (row) => ({
    ...row,
    month: row.date.slice(0, 7),
  }));
}

async function migrateSchedules() {
  const result = await writeSimpleTable('schedules', SCHEDULES, COUNTER_KEYS.SCHEDULES);
  // POST의 UNIQUE(date,start_min) 체크가 계속 정확히 동작하도록 슬롯 센티널을 복원한다.
  const rows = allRows('schedules');
  const writer = firestore.bulkWriter();
  for (const row of rows) {
    const slotId = `${row.date}__${row.start_min}`;
    writer.set(firestore.collection(SCHEDULE_SLOTS).doc(slotId), { schedule_id: row.id });
  }
  await writer.close();
  return result;
}

async function migrateWorryAttempts() {
  const rows = allRows('unconscious_worry_attempts');
  const writer = firestore.bulkWriter();
  for (const row of rows) {
    const ref = firestore.collection(WORRIES).doc(String(row.worry_id)).collection(WORRY_ATTEMPTS).doc(row.date);
    writer.set(ref, row);
  }
  await writer.close();
  return { sqliteCount: rows.length, firestoreWriteCount: rows.length };
}

async function main() {
  const results = {};

  results.tasks = await writeSimpleTable('tasks', TASKS, COUNTER_KEYS.TASKS);
  results.schedules = await migrateSchedules();
  results.focus_map = await migrateFocusMap();
  results.notification_webhooks = await writeSimpleTable('notification_webhooks', NOTIFICATION_WEBHOOKS, COUNTER_KEYS.NOTIFICATION_WEBHOOKS);
  results.customers = await writeSimpleTable('customers', CUSTOMERS, COUNTER_KEYS.CUSTOMERS);
  results.tickets = await migrateTickets();
  results.unconscious_worries = await writeSimpleTable('unconscious_worries', WORRIES, COUNTER_KEYS.WORRIES);
  results.unconscious_worry_attempts = await migrateWorryAttempts();
  results.long_goals = await writeSimpleTable('long_goals', LONG_GOALS, COUNTER_KEYS.LONG_GOALS);
  results.long_goal_subgoals = await writeSimpleTable('long_goal_subgoals', LONG_GOAL_SUBGOALS, COUNTER_KEYS.LONG_GOAL_SUBGOALS);
  results.long_goal_requirements = await writeSimpleTable('long_goal_requirements', LONG_GOAL_REQUIREMENTS, COUNTER_KEYS.LONG_GOAL_REQUIREMENTS);
  results.long_goal_rewards = await writeSimpleTable('long_goal_rewards', LONG_GOAL_REWARDS, COUNTER_KEYS.LONG_GOAL_REWARDS);
  results.bucket_list_items = await writeSimpleTable('bucket_list_items', BUCKET_LIST_ITEMS, COUNTER_KEYS.BUCKET_LIST_ITEMS);
  results.warroom_rails = await writeSimpleTable('warroom_rails', WARROOM_RAILS, COUNTER_KEYS.WARROOM_RAILS);
  results.warroom_members = await writeSimpleTable('warroom_members', WARROOM_MEMBERS, COUNTER_KEYS.WARROOM_MEMBERS);
  results.warroom_member_tasks = await writeSimpleTable('warroom_member_tasks', WARROOM_MEMBER_TASKS, COUNTER_KEYS.WARROOM_MEMBER_TASKS);
  results.daily_notes = await migrateDailyNotes();
  results.meetings = await writeSimpleTable('meetings', MEETINGS, COUNTER_KEYS.MEETINGS);
  results.meeting_overall_items = await writeSimpleTable('meeting_overall_items', MEETING_OVERALL_ITEMS, COUNTER_KEYS.MEETING_OVERALL_ITEMS);
  results.meeting_part_items = await writeSimpleTable('meeting_part_items', MEETING_PART_ITEMS, COUNTER_KEYS.MEETING_PART_ITEMS);
  results.meeting_action_items = await writeSimpleTable('meeting_action_items', MEETING_ACTION_ITEMS, COUNTER_KEYS.MEETING_ACTION_ITEMS);

  console.log('\n=== 마이그레이션 결과 ===');
  let totalSqlite = 0;
  let totalFirestore = 0;
  for (const [table, r] of Object.entries(results)) {
    console.log(`${table.padEnd(28)} sqlite=${r.sqliteCount}  firestore=${r.firestoreWriteCount}`);
    totalSqlite += r.sqliteCount;
    totalFirestore += r.firestoreWriteCount;
  }
  console.log(`${'TOTAL'.padEnd(28)} sqlite=${totalSqlite}  firestore=${totalFirestore}`);

  process.exit(0);
}

main().catch((e) => {
  console.error('마이그레이션 실패:', e);
  process.exit(1);
});
