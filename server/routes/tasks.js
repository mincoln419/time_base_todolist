const express = require('express');
const { firestore } = require('../db/firestore');
const { TASKS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const tasksRef = firestore.collection(TASKS);

// GET /api/tasks — 백로그 전체 조회
router.get('/', asyncHandler(async (req, res) => {
  const snap = await tasksRef.orderBy('position', 'asc').orderBy('id', 'asc').get();
  res.json(snap.docs.map((d) => d.data()));
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
    const doc = { id, title: title.trim(), position: maxPos + 1, created_at: nowString() };
    tx.set(tasksRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(task);
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
