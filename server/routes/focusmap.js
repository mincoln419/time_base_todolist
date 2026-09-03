const express = require('express');
const { firestore } = require('../db/firestore');
const { FOCUS_MAP, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, ConflictError, asyncHandler } = require('../db/util');

const router = express.Router();
const focusMapRef = firestore.collection(FOCUS_MAP);

function toData(body) {
  return {
    items: body.items ?? [],
    step: body.step ?? 0,
    cursor: body.cursor ?? 0,
    addedTaskIds: body.addedTaskIds ?? [],
  };
}

function serialize(doc) {
  const data = doc.data;
  return {
    id: doc.id,
    goal: doc.goal,
    items: data.items,
    step: data.step,
    cursor: data.cursor,
    addedTaskIds: data.addedTaskIds,
    updatedAt: doc.updated_at,
  };
}

// GET /api/focusmap — 저장된 세션 요약 리스트 (updated_at desc)
router.get('/', asyncHandler(async (req, res) => {
  const snap = await focusMapRef.orderBy('updated_at', 'desc').get();
  const list = snap.docs.map((d) => {
    const doc = d.data();
    const items = doc.data.items || [];
    const goldCount = items.filter((it) => it.impact >= 4 && it.ability >= 4).length;
    return {
      id: doc.id,
      goal: doc.goal,
      updatedAt: doc.updated_at,
      step: doc.data.step,
      itemCount: items.length,
      goldCount,
    };
  });
  res.json(list);
}));

// GET /api/focusmap/:id — 세션 전체 상태 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const snap = await focusMapRef.doc(req.params.id).get();
  if (!snap.exists) throw new NotFoundError();
  res.json(serialize(snap.data()));
}));

// POST /api/focusmap — 새 세션 생성
router.post('/', asyncHandler(async (req, res) => {
  const goal = (req.body.goal || '').trim();
  if (!goal) return res.status(400).json({ error: '목표를 입력해주세요.' });

  const doc = await firestore.runTransaction(async (tx) => {
    const dupSnap = await tx.get(focusMapRef.where('goal', '==', goal).limit(1));
    if (!dupSnap.empty) throw new ConflictError('이미 저장된 목표입니다.');

    const id = await nextId(tx, COUNTER_KEYS.FOCUS_MAP);
    const newDoc = { id, goal, data: toData(req.body), updated_at: nowString() };
    tx.set(focusMapRef.doc(String(id)), newDoc);
    return newDoc;
  });
  res.status(201).json(serialize(doc));
}));

// PUT /api/focusmap/:id — 세션 갱신 (upsert)
router.put('/:id', asyncHandler(async (req, res) => {
  const goal = (req.body.goal || '').trim();
  if (!goal) return res.status(400).json({ error: '목표를 입력해주세요.' });

  const ref = focusMapRef.doc(req.params.id);
  const doc = await firestore.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw new NotFoundError();

    const dupSnap = await tx.get(focusMapRef.where('goal', '==', goal).limit(1));
    if (!dupSnap.empty && dupSnap.docs[0].id !== req.params.id) {
      throw new ConflictError('이미 저장된 목표입니다.');
    }

    const newDoc = { id: current.data().id, goal, data: toData(req.body), updated_at: nowString() };
    tx.set(ref, newDoc);
    return newDoc;
  });
  res.json(serialize(doc));
}));

// DELETE /api/focusmap/:id — 세션 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = focusMapRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
