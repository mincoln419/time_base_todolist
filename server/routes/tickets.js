const express = require('express');
const { firestore } = require('../db/firestore');
const { TICKETS } = require('../db/collections');
const { NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const ticketsRef = firestore.collection(TICKETS);

// GET /api/tickets — 전체 고객사의 티켓 목록 조회 (캘린더용, 고객사명 포함)
// SQL의 "ORDER BY (desired_date IS NULL), desired_date ASC, id ASC" (nulls last)는
// Firestore 쿼리로 직접 표현할 수 없어 전체를 읽은 뒤 JS에서 동일하게 정렬한다.
router.get('/', asyncHandler(async (req, res) => {
  const snap = await ticketsRef.get();
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => {
    if (a.desired_date == null && b.desired_date == null) return a.id - b.id;
    if (a.desired_date == null) return 1;
    if (b.desired_date == null) return -1;
    return a.desired_date.localeCompare(b.desired_date) || a.id - b.id;
  });
  res.json(rows);
}));

// PATCH /api/tickets/:id/toggle — 등록 상태(registered) 반전
router.patch('/:id/toggle', asyncHandler(async (req, res) => {
  const ref = ticketsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const updated = { ...snap.data(), registered: snap.data().registered ? 0 : 1 };
  await ref.set(updated);
  const { customer_name, ...rest } = updated;
  res.json(rest);
}));

// PATCH /api/tickets/:id/desired-date — 희망 일자 수정 (빈 값이면 해제)
router.patch('/:id/desired-date', asyncHandler(async (req, res) => {
  const ref = ticketsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const updated = { ...snap.data(), desired_date: req.body.desired_date || null };
  await ref.set(updated);
  const { customer_name, ...rest } = updated;
  res.json(rest);
}));

// DELETE /api/tickets/:id — 티켓 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = ticketsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
