const express = require('express');
const { firestore } = require('../db/firestore');
const { TASKS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const tasksRef = firestore.collection(TASKS);

// GET /api/tasks — 백로그 전체 조회. 최근 사용한(스케줄에 배치한) 할일이 항상 먼저 오도록
// 정렬한다 — 한 번도 사용하지 않은 할일은 last_used_at이 없어 뒤로 밀리고, 그 안에서는
// 기존 position/id 순서를 유지한다.
router.get('/', asyncHandler(async (req, res) => {
  const snap = await tasksRef.get();
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => {
    if (a.last_used_at && b.last_used_at) return b.last_used_at.localeCompare(a.last_used_at);
    if (a.last_used_at) return -1;
    if (b.last_used_at) return 1;
    return a.position - b.position || a.id - b.id;
  });
  res.json(rows);
}));

// POST /api/tasks — 할일 추가
router.post('/', asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '제목을 입력해주세요.' });
  }

  const task = await firestore.runTransaction(async (tx) => {
    const maxSnap = await tx.get(tasksRef.orderBy('position', 'desc').limit(1));
    const maxPos = maxSnap.empty ? -1 : maxSnap.docs[0].data().position;
    const id = await nextId(tx, COUNTER_KEYS.TASKS);
    const doc = { id, title: title.trim(), position: maxPos + 1, created_at: nowString(), last_used_at: null };
    tx.set(tasksRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(task);
}));

// PATCH /api/tasks/:id/touch — 이 할일을 스케줄에 배치했음을 기록(최근 사용 정렬용)
router.patch('/:id/touch', asyncHandler(async (req, res) => {
  const ref = tasksRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const updated = { ...snap.data(), last_used_at: nowString() };
  await ref.set(updated);
  res.json(updated);
}));

// DELETE /api/tasks/:id — 할일 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = tasksRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
