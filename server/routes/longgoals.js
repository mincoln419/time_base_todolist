const express = require('express');
const db = require('../db/database');

const router = express.Router();

const VALID_GOAL_STATUSES = new Set(['active', 'paused', 'done']);
const VALID_ITEM_STATUSES = new Set(['open', 'done']);
const VALID_REQUIREMENT_KINDS = new Set(['task', 'work', 'condition']);
const VALID_REWARD_RECIPIENTS = new Set(['wife', 'kids', 'self']);
const VALID_BUCKET_CATEGORIES = new Set(['achievement', 'experience']);

function requireTitle(value, message) {
  const title = String(value ?? '').trim();
  if (!title) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
  return title;
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function handleRoute(fn) {
  return (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  };
}

function assertGoal(id) {
  const goal = db.prepare('SELECT * FROM long_goals WHERE id = ?').get(id);
  if (!goal) {
    const err = new Error('장기목표를 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return goal;
}

function maxPosition(table, goalId) {
  return db.prepare(`SELECT COALESCE(MAX(position), -1) AS p FROM ${table} WHERE goal_id = ?`).get(goalId).p;
}

function loadData() {
  const goals = db.prepare('SELECT * FROM long_goals ORDER BY created_at DESC, id DESC').all();
  const subgoals = db.prepare('SELECT * FROM long_goal_subgoals ORDER BY position ASC, id ASC').all();
  const requirements = db.prepare('SELECT * FROM long_goal_requirements ORDER BY position ASC, id ASC').all();
  const rewards = db.prepare('SELECT * FROM long_goal_rewards ORDER BY created_at ASC, id ASC').all();
  const bucketItems = db.prepare('SELECT * FROM bucket_list_items ORDER BY created_at DESC, id DESC').all();

  const byGoal = (rows) => rows.reduce((acc, row) => {
    (acc[row.goal_id] ??= []).push(row);
    return acc;
  }, {});
  const subgoalsByGoal = byGoal(subgoals);
  const requirementsByGoal = byGoal(requirements);
  const rewardsByGoal = byGoal(rewards);

  return {
    goals: goals.map((goal) => ({
      ...goal,
      subgoals: subgoalsByGoal[goal.id] ?? [],
      requirements: requirementsByGoal[goal.id] ?? [],
      rewards: rewardsByGoal[goal.id] ?? [],
    })),
    bucketItems,
  };
}

router.get('/', handleRoute((req, res) => {
  res.json(loadData());
}));

router.post('/goals', handleRoute((req, res) => {
  const title = requireTitle(req.body.title, '장기목표 제목을 입력해주세요.');
  const periodStart = optionalText(req.body.period_start);
  const periodEnd = optionalText(req.body.period_end);
  const description = optionalText(req.body.description);

  const result = db.prepare(`
    INSERT INTO long_goals (title, period_start, period_end, description)
    VALUES (?, ?, ?, ?)
  `).run(title, periodStart, periodEnd, description);

  res.status(201).json(db.prepare('SELECT * FROM long_goals WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/goals/:id', handleRoute((req, res) => {
  const current = assertGoal(req.params.id);
  const title = req.body.title == null ? current.title : requireTitle(req.body.title, '장기목표 제목을 입력해주세요.');
  const periodStart = req.body.period_start == null ? current.period_start : optionalText(req.body.period_start);
  const periodEnd = req.body.period_end == null ? current.period_end : optionalText(req.body.period_end);
  const description = req.body.description == null ? current.description : optionalText(req.body.description);
  const status = req.body.status ?? current.status;
  if (!VALID_GOAL_STATUSES.has(status)) {
    return res.status(400).json({ error: '올바른 목표 상태가 아닙니다.' });
  }

  const completedAt = status === 'done' && current.status !== 'done'
    ? db.prepare("SELECT datetime('now', 'localtime') AS now").get().now
    : status === 'done' ? current.completed_at : null;

  db.prepare(`
    UPDATE long_goals
    SET title = ?, period_start = ?, period_end = ?, description = ?, status = ?, completed_at = ?
    WHERE id = ?
  `).run(title, periodStart, periodEnd, description, status, completedAt, req.params.id);

  res.json(db.prepare('SELECT * FROM long_goals WHERE id = ?').get(req.params.id));
}));

router.delete('/goals/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM long_goals WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '장기목표를 찾을 수 없습니다.' });
  res.status(204).send();
}));

router.post('/goals/:goalId/subgoals', handleRoute((req, res) => {
  const goalId = req.params.goalId;
  assertGoal(goalId);
  const title = requireTitle(req.body.title, '세부 목표를 입력해주세요.');
  const notes = optionalText(req.body.notes);
  const periodStart = optionalText(req.body.period_start);
  const periodEnd = optionalText(req.body.period_end);
  const position = maxPosition('long_goal_subgoals', goalId) + 1;

  const result = db.prepare(`
    INSERT INTO long_goal_subgoals (goal_id, title, notes, period_start, period_end, position)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(goalId, title, notes, periodStart, periodEnd, position);

  res.status(201).json(db.prepare('SELECT * FROM long_goal_subgoals WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/subgoals/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM long_goal_subgoals WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '세부 목표를 찾을 수 없습니다.' });
  const status = req.body.status ?? current.status;
  if (!VALID_ITEM_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });

  db.prepare('UPDATE long_goal_subgoals SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM long_goal_subgoals WHERE id = ?').get(req.params.id));
}));

router.delete('/subgoals/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM long_goal_subgoals WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '세부 목표를 찾을 수 없습니다.' });
  res.status(204).send();
}));

router.post('/goals/:goalId/requirements', handleRoute((req, res) => {
  const goalId = req.params.goalId;
  assertGoal(goalId);
  const title = requireTitle(req.body.title, '필요 항목을 입력해주세요.');
  const kind = VALID_REQUIREMENT_KINDS.has(req.body.kind) ? req.body.kind : 'task';
  const notes = optionalText(req.body.notes);
  const position = maxPosition('long_goal_requirements', goalId) + 1;

  const result = db.prepare(`
    INSERT INTO long_goal_requirements (goal_id, kind, title, notes, position)
    VALUES (?, ?, ?, ?, ?)
  `).run(goalId, kind, title, notes, position);

  res.status(201).json(db.prepare('SELECT * FROM long_goal_requirements WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/requirements/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM long_goal_requirements WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '필요 항목을 찾을 수 없습니다.' });
  const status = req.body.status ?? current.status;
  if (!VALID_ITEM_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });

  db.prepare('UPDATE long_goal_requirements SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM long_goal_requirements WHERE id = ?').get(req.params.id));
}));

router.delete('/requirements/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM long_goal_requirements WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '필요 항목을 찾을 수 없습니다.' });
  res.status(204).send();
}));

router.post('/goals/:goalId/rewards', handleRoute((req, res) => {
  const goalId = req.params.goalId;
  assertGoal(goalId);
  const title = requireTitle(req.body.title, '보상 내용을 입력해주세요.');
  const recipient = VALID_REWARD_RECIPIENTS.has(req.body.recipient) ? req.body.recipient : 'self';
  const notes = optionalText(req.body.notes);

  const result = db.prepare(`
    INSERT INTO long_goal_rewards (goal_id, recipient, title, notes)
    VALUES (?, ?, ?, ?)
  `).run(goalId, recipient, title, notes);

  res.status(201).json(db.prepare('SELECT * FROM long_goal_rewards WHERE id = ?').get(result.lastInsertRowid));
}));

router.delete('/rewards/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM long_goal_rewards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '보상 항목을 찾을 수 없습니다.' });
  res.status(204).send();
}));

router.post('/bucket', handleRoute((req, res) => {
  const title = requireTitle(req.body.title, '버킷리스트 내용을 입력해주세요.');
  const category = VALID_BUCKET_CATEGORIES.has(req.body.category) ? req.body.category : 'experience';
  const notes = optionalText(req.body.notes);

  const result = db.prepare(`
    INSERT INTO bucket_list_items (category, title, notes)
    VALUES (?, ?, ?)
  `).run(category, title, notes);

  res.status(201).json(db.prepare('SELECT * FROM bucket_list_items WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/bucket/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM bucket_list_items WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '버킷리스트 항목을 찾을 수 없습니다.' });
  const status = req.body.status ?? current.status;
  if (!VALID_ITEM_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });
  const completedAt = status === 'done' && current.status !== 'done'
    ? db.prepare("SELECT datetime('now', 'localtime') AS now").get().now
    : status === 'done' ? current.completed_at : null;

  db.prepare('UPDATE bucket_list_items SET status = ?, completed_at = ? WHERE id = ?')
    .run(status, completedAt, req.params.id);
  res.json(db.prepare('SELECT * FROM bucket_list_items WHERE id = ?').get(req.params.id));
}));

router.delete('/bucket/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM bucket_list_items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '버킷리스트 항목을 찾을 수 없습니다.' });
  res.status(204).send();
}));

module.exports = router;
