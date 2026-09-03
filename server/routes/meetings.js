const express = require('express');
const { firestore } = require('../db/firestore');
const {
  MEETINGS, MEETING_OVERALL_ITEMS, MEETING_PART_ITEMS, MEETING_ACTION_ITEMS, COUNTER_KEYS,
} = require('../db/collections');
const { nowString, nextId, nextIds, asyncHandler } = require('../db/util');
const { generateActionItems } = require('../services/meetingAi');

const router = express.Router();
const meetingsRef = firestore.collection(MEETINGS);
const overallItemsRef = firestore.collection(MEETING_OVERALL_ITEMS);
const partItemsRef = firestore.collection(MEETING_PART_ITEMS);
const actionItemsRef = firestore.collection(MEETING_ACTION_ITEMS);

const VALID_OVERALL_KINDS = new Set(['share', 'request', 'project']);
const VALID_ACTION_STATUSES = new Set(['대기', '진행중', '완료']);

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

async function assertMeeting(id) {
  const snap = await meetingsRef.doc(String(id)).get();
  if (!snap.exists) {
    const err = new Error('회의록을 찾을 수 없습니다.');
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

async function nextPosition(tx, ref, meetingId) {
  const maxSnap = await tx.get(ref.where('meeting_id', '==', Number(meetingId)).orderBy('position', 'desc').limit(1));
  return maxSnap.empty ? 0 : maxSnap.docs[0].data().position + 1;
}

router.get('/', asyncHandler(async (req, res) => {
  const snap = await meetingsRef.get();
  const meetings = snap.docs.map((d) => d.data()).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  res.json(meetings);
}));

router.post('/', asyncHandler(async (req, res) => {
  const date = requireTitle(req.body.date, '회의 날짜를 입력해주세요.');

  const meeting = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.MEETINGS);
    const doc = { id, date, created_at: nowString() };
    tx.set(meetingsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(meeting);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const meeting = await assertMeeting(req.params.id);
  const meetingId = meeting.id;

  const [overallSnap, partSnap, actionSnap] = await Promise.all([
    overallItemsRef.where('meeting_id', '==', meetingId).get(),
    partItemsRef.where('meeting_id', '==', meetingId).get(),
    actionItemsRef.where('meeting_id', '==', meetingId).get(),
  ]);
  const byPosition = (a, b) => a.position - b.position || a.id - b.id;

  res.json({
    meeting,
    overall_items: overallSnap.docs.map((d) => d.data()).sort(byPosition),
    part_items: partSnap.docs.map((d) => d.data()).sort(byPosition),
    action_items: actionSnap.docs.map((d) => d.data()).sort(byPosition),
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = meetingsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '회의록을 찾을 수 없습니다.' });

  const meetingId = Number(req.params.id);
  const [overallSnap, partSnap, actionSnap] = await Promise.all([
    overallItemsRef.where('meeting_id', '==', meetingId).get(),
    partItemsRef.where('meeting_id', '==', meetingId).get(),
    actionItemsRef.where('meeting_id', '==', meetingId).get(),
  ]);
  const batch = firestore.batch();
  overallSnap.forEach((d) => batch.delete(d.ref));
  partSnap.forEach((d) => batch.delete(d.ref));
  actionSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();

  res.status(204).send();
}));

// --- 전체 섹션 ---

router.post('/:meetingId/overall-items', asyncHandler(async (req, res) => {
  const meetingId = req.params.meetingId;
  await assertMeeting(meetingId);
  const content = requireTitle(req.body.content, '내용을 입력해주세요.');
  const kind = VALID_OVERALL_KINDS.has(req.body.kind) ? req.body.kind : 'share';

  const item = await firestore.runTransaction(async (tx) => {
    const position = await nextPosition(tx, overallItemsRef, meetingId);
    const id = await nextId(tx, COUNTER_KEYS.MEETING_OVERALL_ITEMS);
    const doc = { id, meeting_id: Number(meetingId), kind, content, position, created_at: nowString() };
    tx.set(overallItemsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(item);
}));

router.patch('/overall-items/:id', asyncHandler(async (req, res) => {
  const ref = overallItemsRef.doc(req.params.id);
  const current = await notFound(ref, '항목을 찾을 수 없습니다.');
  const content = req.body.content == null ? current.content : requireTitle(req.body.content, '내용을 입력해주세요.');
  const kind = req.body.kind == null
    ? current.kind
    : (VALID_OVERALL_KINDS.has(req.body.kind) ? req.body.kind : current.kind);

  const updated = { ...current, kind, content };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/overall-items/:id', asyncHandler(async (req, res) => {
  const ref = overallItemsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

// --- 파트별 섹션 ---

router.post('/:meetingId/part-items', asyncHandler(async (req, res) => {
  const meetingId = req.params.meetingId;
  await assertMeeting(meetingId);
  const assignee = requireTitle(req.body.assignee, '담당자를 입력해주세요.');
  const progress = optionalText(req.body.progress);
  const request = optionalText(req.body.request);

  const item = await firestore.runTransaction(async (tx) => {
    const position = await nextPosition(tx, partItemsRef, meetingId);
    const id = await nextId(tx, COUNTER_KEYS.MEETING_PART_ITEMS);
    const doc = { id, meeting_id: Number(meetingId), assignee, progress, request, position, created_at: nowString() };
    tx.set(partItemsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(item);
}));

router.patch('/part-items/:id', asyncHandler(async (req, res) => {
  const ref = partItemsRef.doc(req.params.id);
  const current = await notFound(ref, '항목을 찾을 수 없습니다.');
  const assignee = req.body.assignee == null ? current.assignee : requireTitle(req.body.assignee, '담당자를 입력해주세요.');
  const progress = req.body.progress == null ? current.progress : optionalText(req.body.progress);
  const request = req.body.request == null ? current.request : optionalText(req.body.request);

  const updated = { ...current, assignee, progress, request };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/part-items/:id', asyncHandler(async (req, res) => {
  const ref = partItemsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

// --- 액션아이템 섹션 ---

router.post('/:meetingId/action-items', asyncHandler(async (req, res) => {
  const meetingId = req.params.meetingId;
  await assertMeeting(meetingId);
  const content = requireTitle(req.body.content, '내용을 입력해주세요.');
  const task_type = optionalText(req.body.task_type) ?? '기타';
  const status = req.body.status ?? '대기';
  if (!VALID_ACTION_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });
  const due_date = optionalText(req.body.due_date);
  const assignee = optionalText(req.body.assignee);

  const item = await firestore.runTransaction(async (tx) => {
    const position = await nextPosition(tx, actionItemsRef, meetingId);
    const id = await nextId(tx, COUNTER_KEYS.MEETING_ACTION_ITEMS);
    const doc = {
      id, meeting_id: Number(meetingId), task_type, content, status, due_date, assignee, position,
      created_at: nowString(),
    };
    tx.set(actionItemsRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(item);
}));

router.patch('/action-items/:id', asyncHandler(async (req, res) => {
  const ref = actionItemsRef.doc(req.params.id);
  const current = await notFound(ref, '항목을 찾을 수 없습니다.');
  const content = req.body.content == null ? current.content : requireTitle(req.body.content, '내용을 입력해주세요.');
  const task_type = req.body.task_type == null ? current.task_type : (optionalText(req.body.task_type) ?? '기타');
  const status = req.body.status ?? current.status;
  if (!VALID_ACTION_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });
  const due_date = req.body.due_date == null ? current.due_date : optionalText(req.body.due_date);
  const assignee = req.body.assignee == null ? current.assignee : optionalText(req.body.assignee);

  const updated = { ...current, content, task_type, status, due_date, assignee };
  await ref.set(updated);
  res.json(updated);
}));

router.delete('/action-items/:id', asyncHandler(async (req, res) => {
  const ref = actionItemsRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  await ref.delete();
  res.status(204).send();
}));

// Design Ref: §5 — 회의 원문을 서버로만 전달, 외부 AI 호출/키는 서비스 계층에 격리
router.post('/:meetingId/action-items/generate', asyncHandler(async (req, res) => {
  const meetingId = req.params.meetingId;
  await assertMeeting(meetingId);
  const notes = requireTitle(req.body.notes, '회의 원문을 입력해주세요.');

  const items = await generateActionItems(notes);

  const created = await firestore.runTransaction(async (tx) => {
    const startPosition = await nextPosition(tx, actionItemsRef, meetingId);
    const ids = await nextIds(tx, COUNTER_KEYS.MEETING_ACTION_ITEMS, items.length);
    return items.map((item, i) => {
      const doc = {
        id: ids[i],
        meeting_id: Number(meetingId),
        task_type: item.task_type,
        content: item.content,
        status: item.status,
        due_date: item.due_date,
        assignee: item.assignee,
        position: startPosition + i,
        created_at: nowString(),
      };
      tx.set(actionItemsRef.doc(String(doc.id)), doc);
      return doc;
    });
  });

  res.status(201).json(created);
}));

module.exports = router;
