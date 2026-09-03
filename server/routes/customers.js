const express = require('express');
const { firestore } = require('../db/firestore');
const { CUSTOMERS, TICKETS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const customersRef = firestore.collection(CUSTOMERS);
const ticketsRef = firestore.collection(TICKETS);

// tickets 컬렉션에는 GET /api/tickets용 customer_name이 비정규화되어 있다 —
// 그 외 라우트(원래 SQLite tickets 테이블 컬럼만 갖던 곳)의 응답에서는 제외한다.
function toTicketResponse(doc) {
  const { id, customer_id, title, registered, desired_date, created_at } = doc;
  return { id, customer_id, title, registered, desired_date, created_at };
}

// GET /api/customers — 고객사 목록 조회
router.get('/', asyncHandler(async (req, res) => {
  const snap = await customersRef.orderBy('id', 'asc').get();
  res.json(snap.docs.map((d) => d.data()));
}));

// POST /api/customers — 고객사 추가
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '고객사명을 입력해주세요.' });
  }

  const customer = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.CUSTOMERS);
    const doc = { id, name: name.trim(), created_at: nowString() };
    tx.set(customersRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(customer);
}));

// DELETE /api/customers/:id — 고객사 삭제 (+ 소속 tickets 일괄 삭제)
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = customersRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const ticketsSnap = await ticketsRef.where('customer_id', '==', Number(req.params.id)).get();
  const batch = firestore.batch();
  ticketsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();

  res.status(204).send();
}));

// GET /api/customers/:id/tickets — 해당 고객사의 티켓 목록 조회
router.get('/:id/tickets', asyncHandler(async (req, res) => {
  const customerSnap = await customersRef.doc(req.params.id).get();
  if (!customerSnap.exists) throw new NotFoundError();

  const snap = await ticketsRef.where('customer_id', '==', Number(req.params.id)).orderBy('id', 'asc').get();
  res.json(snap.docs.map((d) => toTicketResponse(d.data())));
}));

// POST /api/customers/:id/tickets — 티켓 추가
router.post('/:id/tickets', asyncHandler(async (req, res) => {
  const customerSnap = await customersRef.doc(req.params.id).get();
  if (!customerSnap.exists) throw new NotFoundError();

  const { title, desired_date } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '제목을 입력해주세요.' });
  }

  const ticket = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.TICKETS);
    const doc = {
      id,
      customer_id: Number(req.params.id),
      customer_name: customerSnap.data().name,
      title: title.trim(),
      registered: 0,
      desired_date: desired_date || null,
      created_at: nowString(),
    };
    tx.set(ticketsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(toTicketResponse(ticket));
}));

module.exports = router;
