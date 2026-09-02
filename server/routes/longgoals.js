const express = require('express');
const { firestore } = require('../db/firestore');
const {
  LONG_GOALS, LONG_GOAL_SUBGOALS, LONG_GOAL_REQUIREMENTS, LONG_GOAL_REWARDS, BUCKET_LIST_ITEMS, COUNTER_KEYS,
} = require('../db/collections');
const { nowString, nextId, asyncHandler } = require('../db/util');

const router = express.Router();
const longGoalsRef = firestore.collection(LONG_GOALS);
const subgoalsRef = firestore.collection(LONG_GOAL_SUBGOALS);
const requirementsRef = firestore.collection(LONG_GOAL_REQUIREMENTS);
const rewardsRef = firestore.collection(LONG_GOAL_REWARDS);
const bucketRef = firestore.collection(BUCKET_LIST_ITEMS);

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

async function assertGoal(id) {
  const snap = await longGoalsRef.doc(String(id)).get();
  if (!snap.exists) {
    const err = new Error('장기목표를 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return snap.data();
}

async function notFound(ref, message) {
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error(message);
    err.status = 404;
    throw err;
  }
  return snap.data();
}

// 트랜잭션 안에서 goal_id로 스코프된 컬렉션의 다음 position(MAX+1)을 구한다.
async function nextPosition(tx, ref, goalId) {
  const maxSnap = await tx.get(ref.where('goal_id', '==', Number(goalId)).orderBy('position', 'desc').limit(1));
  return maxSnap.empty ? 0 : maxSnap.docs[0].data().position + 1;
}

router.get('/', asyncHandler(async (req, res) => {
  const [goalsSnap, subSnap, reqSnap, rewSnap, bucketSnap] = await Promise.all([
    longGoalsRef.get(), subgoalsRef.get(), requirementsRef.get(), rewardsRef.get(), bucketRef.get(),
  ]);

  const goals = goalsSnap.docs.map((d) => d.data()).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const subgoals = subSnap.docs.map((d) => d.data()).sort((a, b) => a.position - b.position || a.id - b.id);
  const requirements = reqSnap.docs.map((d) => d.data()).sort((a, b) => a.position - b.position || a.id - b.id);
  const rewards = rewSnap.docs.map((d) => d.data()).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  const bucketItems = bucketSnap.docs.map((d) => d.data()).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

  const byGoal = (rows) => rows.reduce((acc, row) => {
    (acc[row.goal_id] ??= []).push(row);
    return acc;
  }, {});
  const subgoalsByGoal = byGoal(subgoals);
  const requirementsByGoal = byGoal(requirements);
  const rewardsByGoal = byGoal(rewards);

  res.json({
    goals: goals.map((goal) => ({
      ...goal,
      subgoals: subgoalsByGoal[goal.id] ?? [],
      requirements: requirementsByGoal[goal.id] ?? [],
      rewards: rewardsByGoal[goal.id] ?? [],
    })),
    bucketItems,
  });
}));

router.post('/goals', asyncHandler(async (req, res) => {
  const title = requireTitle(req.body.title, '장기목표 제목을 입력해주세요.');
  const period_start = optionalText(req.body.period_start);
  const period_end = optionalText(req.body.period_end);
  const description = optionalText(req.body.description);

  const goal = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.LONG_GOALS);
    const doc = {
      id, title, period_start, period_end, description,
      status: 'active', created_at: nowString(), completed_at: null,
    };
    tx.set(longGoalsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(goal);
}));

router.patch('/goals/:id', asyncHandler(async (req, res) => {
  const current = await assertGoal(req.params.id);
  const title = req.body.title == null ? current.title : requireTitle(req.body.title, '장기목표 제목을 입력해주세요.');
  const period_start = req.body.period_start == null ? current.period_start : optionalText(req.body.period_start);
  const period_end = req.body.period_end == null ? current.period_end : optionalText(req.body.period_end);
  const description = req.body.description == null ? current.description : optionalText(req.body.description);
  const status = req.body.status ?? current.status;
  if (!VALID_GOAL_STATUSES.has(status)) {
    return res.status(400).json({ error: '올바른 목표 상태가 아닙니다.' });
  }

  const completed_at = status === 'done' && current.status !== 'done'
    ? nowString()
    : status === 'done' ? current.completed_at : null;

  const updated = { ...current, title, period_start, period_end, description, status, completed_at };
  await longGoalsRef.doc(req.params.id).set(updated);
  res.json(updated);
}));

router.delete('/goals/:id', asyncHandler(async (req, res) => {
  const ref = longGoalsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '장기목표를 찾을 수 없습니다.' });

  const goalId = Number(req.params.id);
  const [subSnap, reqSnap, rewSnap] = await Promise.all([
    subgoalsRef.where('goal_id', '==', goalId).get(),
    requirementsRef.where('goal_id', '==', goalId).get(),
    rewardsRef.where('goal_id', '==', goalId).get(),
  ]);
  const batch = firestore.batch();
  subSnap.forEach((d) => batch.delete(d.ref));
  reqSnap.forEach((d) => batch.delete(d.ref));
  rewSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();

  res.status(204).send();
}));

router.post('/goals/:goalId/subgoals', asyncHandler(async (req, res) => {
  const goalId = req.params.goalId;
  await assertGoal(goalId);
  const title = requireTitle(req.body.title, '세부 목표를 입력해주세요.');
  const notes = optionalText(req.body.notes);
  const period_start = optionalText(req.body.period_start);
  const period_end = optionalText(req.body.period_end);

  const subgoal = await firestore.runTransaction(async (tx) => {
    const position = await nextPosition(tx, subgoalsRef, goalId);
    const id = await nextId(tx, COUNTER_KEYS.LONG_GOAL_SUBGOALS);
    const doc = {
      id, goal_id: Number(goalId), title, notes, period_start, period_end,
      status: 'open', position, created_at: nowString(),
    };
    tx.set(subgoalsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(subgoal);
}));

router.patch('/subgoals/:id', asyncHandler(async (req, res) => {
  const ref = subgoalsRef.doc(req.params.id);
  const current = await notFound(ref, '세부 목표를 찾을 수 없습니다.');
  const title = req.body.title == null ? current.title : requireTitle(req.body.title, '세부 목표를 입력해주세요.');
  const notes = req.body.notes == null ? current.notes : optionalText(req.body.notes);
  const period_start = req.body.period_start == null ? current.period_start : optionalText(req.body.period_start);
  const period_end = req.body.period_end == null ? current.period_end : optionalText(req.body.period_end);
  const status = req.body.status ?? current.status;
  if (!VALID_ITEM_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });

  const updated = { ...current, title, notes, period_start, period_end, status };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/subgoals/:id', asyncHandler(async (req, res) => {
  const ref = subgoalsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '세부 목표를 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

router.post('/goals/:goalId/requirements', asyncHandler(async (req, res) => {
  const goalId = req.params.goalId;
  await assertGoal(goalId);
  const title = requireTitle(req.body.title, '필요 항목을 입력해주세요.');
  const kind = VALID_REQUIREMENT_KINDS.has(req.body.kind) ? req.body.kind : 'task';
  const notes = optionalText(req.body.notes);

  const requirement = await firestore.runTransaction(async (tx) => {
    const position = await nextPosition(tx, requirementsRef, goalId);
    const id = await nextId(tx, COUNTER_KEYS.LONG_GOAL_REQUIREMENTS);
    const doc = { id, goal_id: Number(goalId), kind, title, notes, status: 'open', position, created_at: nowString() };
    tx.set(requirementsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(requirement);
}));

router.patch('/requirements/:id', asyncHandler(async (req, res) => {
  const ref = requirementsRef.doc(req.params.id);
  const current = await notFound(ref, '필요 항목을 찾을 수 없습니다.');
  const title = req.body.title == null ? current.title : requireTitle(req.body.title, '필요 항목을 입력해주세요.');
  const kind = req.body.kind == null
    ? current.kind
    : (VALID_REQUIREMENT_KINDS.has(req.body.kind) ? req.body.kind : current.kind);
  const notes = req.body.notes == null ? current.notes : optionalText(req.body.notes);
  const status = req.body.status ?? current.status;
  if (!VALID_ITEM_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });

  const updated = { ...current, title, kind, notes, status };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/requirements/:id', asyncHandler(async (req, res) => {
  const ref = requirementsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '필요 항목을 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

router.post('/goals/:goalId/rewards', asyncHandler(async (req, res) => {
  const goalId = req.params.goalId;
  await assertGoal(goalId);
  const title = requireTitle(req.body.title, '보상 내용을 입력해주세요.');
  const recipient = VALID_REWARD_RECIPIENTS.has(req.body.recipient) ? req.body.recipient : 'self';
  const notes = optionalText(req.body.notes);

  const reward = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.LONG_GOAL_REWARDS);
    const doc = { id, goal_id: Number(goalId), recipient, title, notes, created_at: nowString() };
    tx.set(rewardsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(reward);
}));

router.patch('/rewards/:id', asyncHandler(async (req, res) => {
  const ref = rewardsRef.doc(req.params.id);
  const current = await notFound(ref, '보상 항목을 찾을 수 없습니다.');
  const title = req.body.title == null ? current.title : requireTitle(req.body.title, '보상 내용을 입력해주세요.');
  const recipient = req.body.recipient == null
    ? current.recipient
    : (VALID_REWARD_RECIPIENTS.has(req.body.recipient) ? req.body.recipient : current.recipient);
  const notes = req.body.notes == null ? current.notes : optionalText(req.body.notes);

  const updated = { ...current, title, recipient, notes };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/rewards/:id', asyncHandler(async (req, res) => {
  const ref = rewardsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '보상 항목을 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

router.post('/bucket', asyncHandler(async (req, res) => {
  const title = requireTitle(req.body.title, '버킷리스트 내용을 입력해주세요.');
  const category = VALID_BUCKET_CATEGORIES.has(req.body.category) ? req.body.category : 'experience';
  const notes = optionalText(req.body.notes);

  const item = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.BUCKET_LIST_ITEMS);
    const doc = { id, category, title, notes, status: 'open', created_at: nowString(), completed_at: null };
    tx.set(bucketRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(item);
}));

router.patch('/bucket/:id', asyncHandler(async (req, res) => {
  const ref = bucketRef.doc(req.params.id);
  const current = await notFound(ref, '버킷리스트 항목을 찾을 수 없습니다.');
  const status = req.body.status ?? current.status;
  if (!VALID_ITEM_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });
  const completed_at = status === 'done' && current.status !== 'done'
    ? nowString()
    : status === 'done' ? current.completed_at : null;

  const updated = { ...current, status, completed_at };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/bucket/:id', asyncHandler(async (req, res) => {
  const ref = bucketRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '버킷리스트 항목을 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
