const express = require('express');
const { firestore } = require('../db/firestore');
const { SCHEDULES, SCHEDULE_SLOTS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, ConflictError, asyncHandler } = require('../db/util');

const router = express.Router();
const schedulesRef = firestore.collection(SCHEDULES);
const slotsRef = firestore.collection(SCHEDULE_SLOTS);

function slotId(date, startMin) {
  return `${date}__${startMin}`;
}

// GET /api/schedules?date=YYYY-MM-DD
router.get('/', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });

  const snap = await schedulesRef.where('date', '==', date).orderBy('start_min', 'asc').get();
  res.json(snap.docs.map((d) => d.data()));
}));

// POST /api/schedules — DnD 드롭 시 스케줄 생성
router.post('/', asyncHandler(async (req, res) => {
  const { title, date, start_min, end_min } = req.body;

  if (!title || !title.trim() || !date || start_min == null || end_min == null) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
  }
  if (end_min <= start_min) {
    return res.status(400).json({ error: 'end_min은 start_min보다 커야 합니다.' });
  }

  const schedule = await firestore.runTransaction(async (tx) => {
    const slotRef = slotsRef.doc(slotId(date, start_min));
    const slotSnap = await tx.get(slotRef);
    if (slotSnap.exists) throw new ConflictError('해당 시간대에 이미 일정이 있습니다.');

    const id = await nextId(tx, COUNTER_KEYS.SCHEDULES);
    const doc = { id, title: title.trim(), date, start_min, end_min, status: 'planned', created_at: nowString() };
    tx.set(slotRef, { schedule_id: id });
    tx.set(schedulesRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(schedule);
}));

// PUT /api/schedules/:id — 상태 또는 시간 수정 (기존과 동일하게 UNIQUE 재검사는 하지 않음)
router.put('/:id', asyncHandler(async (req, res) => {
  const { title, status, start_min, end_min } = req.body;
  const ref = schedulesRef.doc(req.params.id);

  if (title != null && !title.trim()) {
    return res.status(400).json({ error: '제목은 비워둘 수 없습니다.' });
  }

  const updated = await firestore.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw new NotFoundError();
    const cur = current.data();

    const newDoc = {
      ...cur,
      title: title != null ? title.trim() : cur.title,
      status: status ?? cur.status,
      start_min: start_min ?? cur.start_min,
      end_min: end_min ?? cur.end_min,
    };

    // 시간이 바뀌면 슬롯 센티널도 함께 옮겨 이후 POST의 UNIQUE 체크가 계속 정확히 동작하게 한다.
    if (newDoc.start_min !== cur.start_min) {
      tx.delete(slotsRef.doc(slotId(cur.date, cur.start_min)));
      tx.set(slotsRef.doc(slotId(newDoc.date, newDoc.start_min)), { schedule_id: newDoc.id });
    }
    tx.set(ref, newDoc);
    return newDoc;
  });

  res.json(updated);
}));

// DELETE /api/schedules/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = schedulesRef.doc(req.params.id);

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new NotFoundError();
    const cur = snap.data();
    tx.delete(slotsRef.doc(slotId(cur.date, cur.start_min)));
    tx.delete(ref);
  });

  res.status(204).send();
}));

module.exports = router;
