// 1회성 마이그레이션: 로컬 SQLite(data/todo.db)의 schedules(일정관리) 데이터만 Firestore로 옮긴다.
// 실행: node server/scripts/migrate-schedules-to-firestore.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const db = require('../db/database');
const { firestore } = require('../db/firestore');
const { SCHEDULES, SCHEDULE_SLOTS, COUNTERS, COUNTER_KEYS } = require('../db/collections');

async function main() {
  const rows = db.prepare('SELECT * FROM schedules').all();

  const writer = firestore.bulkWriter();
  let maxId = 0;
  for (const row of rows) {
    writer.set(firestore.collection(SCHEDULES).doc(String(row.id)), row);
    writer.set(firestore.collection(SCHEDULE_SLOTS).doc(`${row.date}__${row.start_min}`), { schedule_id: row.id });
    if (row.id > maxId) maxId = row.id;
  }
  await writer.close();
  await firestore.collection(COUNTERS).doc(COUNTER_KEYS.SCHEDULES).set({ value: maxId });

  console.log(`schedules: sqlite=${rows.length} firestore=${rows.length} (counter=${maxId})`);
  process.exit(0);
}

main().catch((e) => {
  console.error('마이그레이션 실패:', e);
  process.exit(1);
});
