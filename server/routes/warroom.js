const express = require('express');
const { firestore } = require('../db/firestore');
const { WARROOM_RAILS, WARROOM_MEMBERS, WARROOM_MEMBER_TASKS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const railsRef = firestore.collection(WARROOM_RAILS);
const membersRef = firestore.collection(WARROOM_MEMBERS);
const tasksRef = firestore.collection(WARROOM_MEMBER_TASKS);

function requireTitle(value, message) {
  const title = String(value ?? '').trim();
  if (!title) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
  return title;
}

async function assertRail(id) {
  const snap = await railsRef.doc(String(id)).get();
  if (!snap.exists) {
    const err = new Error('레일을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return snap.data();
}

async function assertMember(id) {
  const snap = await membersRef.doc(String(id)).get();
  if (!snap.exists) {
    const err = new Error('인원을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return snap.data();
}

router.get('/', asyncHandler(async (req, res) => {
  const [railsSnap, membersSnap, tasksSnap] = await Promise.all([railsRef.get(), membersRef.get(), tasksRef.get()]);
  const byPosition = (a, b) => a.position - b.position || a.id - b.id;

  const rails = railsSnap.docs.map((d) => d.data()).sort(byPosition);
  const members = membersSnap.docs.map((d) => d.data()).sort(byPosition);
  const tasks = tasksSnap.docs.map((d) => d.data()).sort(byPosition);

  const tasksByMember = tasks.reduce((acc, task) => {
    (acc[task.member_id] ??= []).push(task);
    return acc;
  }, {});

  res.json({
    rails,
    members: members.map((member) => ({ ...member, tasks: tasksByMember[member.id] ?? [] })),
  });
}));

router.post('/rails', asyncHandler(async (req, res) => {
  const name = requireTitle(req.body.name, '레일 이름을 입력해주세요.');

  const rail = await firestore.runTransaction(async (tx) => {
    const maxSnap = await tx.get(railsRef.orderBy('position', 'desc').limit(1));
    const position = maxSnap.empty ? 0 : maxSnap.docs[0].data().position + 1;
    const id = await nextId(tx, COUNTER_KEYS.WARROOM_RAILS);
    const doc = { id, name, position, created_at: nowString() };
    tx.set(railsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(rail);
}));

router.patch('/rails/:id', asyncHandler(async (req, res) => {
  const current = await assertRail(req.params.id);
  const name = req.body.name == null ? current.name : requireTitle(req.body.name, '레일 이름을 입력해주세요.');

  const updated = { ...current, name };
  await railsRef.doc(req.params.id).set(updated);
  res.json(updated);
}));

router.post('/rails/:id/move', asyncHandler(async (req, res) => {
  const current = await assertRail(req.params.id);
  const direction = req.body.direction;
  if (direction !== 'up' && direction !== 'down') {
    const err = new Error('올바른 이동 방향이 아닙니다.');
    err.status = 400;
    throw err;
  }

  const neighborQuery = direction === 'up'
    ? railsRef.where('position', '<', current.position).orderBy('position', 'desc').limit(1)
    : railsRef.where('position', '>', current.position).orderBy('position', 'asc').limit(1);
  const neighborSnap = await neighborQuery.get();
  if (neighborSnap.empty) return res.status(204).send();
  const neighborRef = neighborSnap.docs[0].ref;

  await firestore.runTransaction(async (tx) => {
    const curRef = railsRef.doc(req.params.id);
    const [curSnap, neighSnap] = await Promise.all([tx.get(curRef), tx.get(neighborRef)]);
    if (!curSnap.exists || !neighSnap.exists) return;
    tx.update(curRef, { position: neighSnap.data().position });
    tx.update(neighborRef, { position: curSnap.data().position });
  });

  res.status(204).send();
}));

router.delete('/rails/:id', asyncHandler(async (req, res) => {
  const ref = railsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '레일을 찾을 수 없습니다.' });

  // SQLite의 ON DELETE SET NULL을 수동으로 재현 — 이 레일에 배치된 인원을 미배치로 되돌린다.
  const railId = Number(req.params.id);
  const affected = await membersRef.where('rail_id', '==', railId).get();
  const batch = firestore.batch();
  affected.forEach((d) => batch.update(d.ref, { rail_id: null }));
  batch.delete(ref);
  await batch.commit();

  res.status(204).send();
}));

router.post('/members', asyncHandler(async (req, res) => {
  const name = requireTitle(req.body.name, '이름을 입력해주세요.');

  const member = await firestore.runTransaction(async (tx) => {
    const maxSnap = await tx.get(membersRef.orderBy('position', 'desc').limit(1));
    const position = maxSnap.empty ? 0 : maxSnap.docs[0].data().position + 1;
    const id = await nextId(tx, COUNTER_KEYS.WARROOM_MEMBERS);
    const doc = { id, name, rail_id: null, position, created_at: nowString() };
    tx.set(membersRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json({ ...member, tasks: [] });
}));

router.patch('/members/:id', asyncHandler(async (req, res) => {
  const current = await assertMember(req.params.id);
  const rail_id = 'rail_id' in req.body ? req.body.rail_id : current.rail_id;
  if (rail_id != null) await assertRail(rail_id);

  const updated = { ...current, rail_id };
  await membersRef.doc(req.params.id).set(updated);

  const tasksSnap = await tasksRef.where('member_id', '==', Number(req.params.id)).get();
  const tasks = tasksSnap.docs.map((d) => d.data()).sort((a, b) => a.position - b.position || a.id - b.id);
  res.json({ ...updated, tasks });
}));

router.delete('/members/:id', asyncHandler(async (req, res) => {
  const ref = membersRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '인원을 찾을 수 없습니다.' });

  const memberId = Number(req.params.id);
  const taskSnap = await tasksRef.where('member_id', '==', memberId).get();
  const batch = firestore.batch();
  taskSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();

  res.status(204).send();
}));

router.post('/members/:id/tasks', asyncHandler(async (req, res) => {
  const memberId = req.params.id;
  await assertMember(memberId);
  const title = requireTitle(req.body.title, '업무명을 입력해주세요.');

  const task = await firestore.runTransaction(async (tx) => {
    const maxSnap = await tx.get(
      tasksRef.where('member_id', '==', Number(memberId)).orderBy('position', 'desc').limit(1)
    );
    const position = maxSnap.empty ? 0 : maxSnap.docs[0].data().position + 1;
    const id = await nextId(tx, COUNTER_KEYS.WARROOM_MEMBER_TASKS);
    const doc = { id, member_id: Number(memberId), title, is_primary: 0, position, created_at: nowString() };
    tx.set(tasksRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(task);
}));

router.patch('/member-tasks/:id', asyncHandler(async (req, res) => {
  const ref = tasksRef.doc(req.params.id);

  const updated = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new NotFoundError('업무 태그를 찾을 수 없습니다.');
    const current = snap.data();
    const is_primary = req.body.is_primary == null ? current.is_primary : (req.body.is_primary ? 1 : 0);

    if (is_primary === 1) {
      const siblingsSnap = await tx.get(tasksRef.where('member_id', '==', current.member_id));
      siblingsSnap.forEach((d) => {
        if (d.id !== req.params.id) tx.update(d.ref, { is_primary: 0 });
      });
    }

    const doc = { ...current, is_primary };
    tx.set(ref, doc);
    return doc;
  });

  res.json(updated);
}));

router.delete('/member-tasks/:id', asyncHandler(async (req, res) => {
  const ref = tasksRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '업무 태그를 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
