const express = require('express');
const { firestore } = require('../db/firestore');
const {
  TASKS, SCHEDULES, FOCUS_MAP, CUSTOMERS, TICKETS, WORRIES, WORRY_ATTEMPTS,
  LONG_GOALS, LONG_GOAL_SUBGOALS, LONG_GOAL_REQUIREMENTS, LONG_GOAL_REWARDS, BUCKET_LIST_ITEMS,
  WARROOM_RAILS, WARROOM_MEMBERS, WARROOM_MEMBER_TASKS, DAILY_NOTES,
} = require('../db/collections');
const { asyncHandler } = require('../db/util');

const router = express.Router();

// 백업 JSON의 키는 예전 SQLite 테이블 이름을 그대로 쓴다 — 이미 내려받은 백업 파일과의
// 호환을 유지하기 위함. unconscious_worry_attempts만 서브컬렉션(worries/{id}/attempts)이라
// 별도 처리한다(아래 EXPORT_ATTEMPTS/IMPORT_ATTEMPTS).
const SIMPLE_TABLES = {
  tasks: TASKS,
  schedules: SCHEDULES,
  focus_map: FOCUS_MAP,
  customers: CUSTOMERS,
  tickets: TICKETS,
  unconscious_worries: WORRIES,
  long_goal_rewards: LONG_GOAL_REWARDS,
  long_goal_requirements: LONG_GOAL_REQUIREMENTS,
  long_goal_subgoals: LONG_GOAL_SUBGOALS,
  long_goals: LONG_GOALS,
  bucket_list_items: BUCKET_LIST_ITEMS,
  warroom_rails: WARROOM_RAILS,
  warroom_members: WARROOM_MEMBERS,
  warroom_member_tasks: WARROOM_MEMBER_TASKS,
  daily_notes: DAILY_NOTES,
};
const ATTEMPTS_TABLE = 'unconscious_worry_attempts';

const BACKUP_TYPES = {
  full: {
    label: '전체',
    tables: [
      'tasks', 'schedules', 'focus_map', 'customers', 'tickets',
      'unconscious_worries', 'unconscious_worry_attempts',
      'long_goal_rewards', 'long_goal_requirements', 'long_goal_subgoals', 'long_goals',
      'bucket_list_items', 'warroom_rails', 'warroom_members', 'warroom_member_tasks', 'daily_notes',
    ],
    deleteTables: [
      'tickets', 'unconscious_worry_attempts', 'unconscious_worries',
      'long_goal_rewards', 'long_goal_requirements', 'long_goal_subgoals', 'long_goals',
      'bucket_list_items', 'customers', 'tasks', 'schedules', 'focus_map',
      'warroom_member_tasks', 'warroom_members', 'warroom_rails', 'daily_notes',
    ],
  },
  schedule: { label: '일정관리', tables: ['tasks', 'schedules'], deleteTables: ['tasks', 'schedules'] },
  focusmap: { label: '포커스 맵', tables: ['focus_map'], deleteTables: ['focus_map'] },
  customers: { label: '고객사 티켓', tables: ['customers', 'tickets'], deleteTables: ['tickets', 'customers'] },
  calendar: { label: '캘린더', tables: ['customers', 'tickets'], deleteTables: ['tickets', 'customers'] },
  worries: {
    label: '무의식 고민목록',
    tables: ['unconscious_worries', 'unconscious_worry_attempts'],
    deleteTables: ['unconscious_worry_attempts', 'unconscious_worries'],
  },
  longgoals: {
    label: '장기목표',
    tables: ['long_goals', 'long_goal_subgoals', 'long_goal_requirements', 'long_goal_rewards', 'bucket_list_items'],
    deleteTables: ['long_goal_rewards', 'long_goal_requirements', 'long_goal_subgoals', 'long_goals', 'bucket_list_items'],
  },
  warroom: {
    label: '업무 배치 보드',
    tables: ['warroom_rails', 'warroom_members', 'warroom_member_tasks'],
    deleteTables: ['warroom_member_tasks', 'warroom_members', 'warroom_rails'],
  },
  dailynote: { label: '데일리노트', tables: ['daily_notes'], deleteTables: ['daily_notes'] },
};

function getBackupType(type) {
  return BACKUP_TYPES[type] ? type : 'full';
}

async function exportTable(table) {
  if (table === ATTEMPTS_TABLE) {
    const snap = await firestore.collectionGroup(WORRY_ATTEMPTS).get();
    return snap.docs.map((d) => d.data());
  }
  const snap = await firestore.collection(SIMPLE_TABLES[table]).get();
  // tickets에 붙은 customer_name은 SQL 원본에 없던 비정규화 필드라 백업 파일 shape에서는 제외
  return snap.docs.map((d) => {
    const { customer_name, ...rest } = d.data();
    return rest;
  });
}

async function deleteTable(table) {
  if (table === ATTEMPTS_TABLE) {
    const snap = await firestore.collectionGroup(WORRY_ATTEMPTS).get();
    const writer = firestore.bulkWriter();
    snap.forEach((d) => writer.delete(d.ref));
    await writer.close();
    return;
  }
  await firestore.recursiveDelete(firestore.collection(SIMPLE_TABLES[table]));
}

async function importTable(table, rows, customerNameById) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const writer = firestore.bulkWriter();
  let count = 0;
  for (const row of rows) {
    if (table === ATTEMPTS_TABLE) {
      if (row.worry_id == null || !row.date) continue;
      const ref = firestore.collection(WORRIES).doc(String(row.worry_id)).collection(WORRY_ATTEMPTS).doc(row.date);
      writer.set(ref, row);
    } else {
      if (row.id == null) continue;
      const doc = table === 'tickets' && customerNameById
        ? { ...row, customer_name: customerNameById.get(Number(row.customer_id)) ?? null }
        : row;
      writer.set(firestore.collection(SIMPLE_TABLES[table]).doc(String(row.id)), doc);
    }
    count += 1;
  }
  await writer.close();
  return count;
}

// GET /api/backup/export?type=TYPE — 선택한 화면 데이터를 JSON으로 내보내기
router.get('/export', asyncHandler(async (req, res) => {
  const type = getBackupType(req.query.type);
  const config = BACKUP_TYPES[type];
  const data = {};
  for (const table of config.tables) {
    data[table] = await exportTable(table);
  }
  res.json({ version: 2, type, label: config.label, exportedAt: new Date().toISOString(), data });
}));

// POST /api/backup/import — 백업 파일의 type에 해당하는 데이터만 교체
router.post('/import', asyncHandler(async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '올바른 백업 파일이 아닙니다.' });
  }

  const type = getBackupType(req.body.type);
  const config = BACKUP_TYPES[type];
  const counts = {};

  try {
    for (const table of config.deleteTables) {
      await deleteTable(table);
    }

    // tickets를 새로 쓸 때 customer_name을 다시 채워 넣기 위해 customers 행을 먼저 참조.
    const customerNameById = new Map((data.customers || []).map((c) => [Number(c.id), c.name]));

    for (const table of config.tables) {
      counts[table] = await importTable(table, data[table], customerNameById);
    }
  } catch (e) {
    return res.status(400).json({ error: '가져오기에 실패했습니다: ' + e.message });
  }

  res.json({ type, label: config.label, imported: counts });
}));

module.exports = router;
