// Design Ref: §4/§5.4 — longgoals.js 헬퍼 패턴 재사용, AI 생성 라우트는 async이므로 handleRoute를 async-safe로 확장
const express = require('express');
const db = require('../db/database');
const { generateActionItems } = require('../services/meetingAi');

const router = express.Router();

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

// Design Ref: §5.4 — 기존 longgoals.js의 handleRoute는 동기 전용. 이 라우트는 AI 생성(await)이 필요한
// 최초의 라우트라 Promise.resolve로 감싸 동기/비동기 핸들러를 모두 지원하도록 확장한다.
function handleRoute(fn) {
  return (req, res, next) => {
    // Design Ref: §5.4 — fn(req,res)를 .then() 콜백 안에서 호출해야 동기 throw도 프로미스 거부로 전환되어 catch에 잡힌다.
    // Promise.resolve(fn(req,res))처럼 인자 평가 단계에서 바로 호출하면 동기 throw는 catch를 건너뛰고 그대로 전파된다.
    Promise.resolve().then(() => fn(req, res)).catch((err) => {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    });
  };
}

function assertMeeting(id) {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
  if (!meeting) {
    const err = new Error('회의록을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return meeting;
}

function maxPosition(table, meetingId) {
  return db.prepare(`SELECT COALESCE(MAX(position), -1) AS p FROM ${table} WHERE meeting_id = ?`).get(meetingId).p;
}

router.get('/', handleRoute((req, res) => {
  const meetings = db.prepare('SELECT * FROM meetings ORDER BY date DESC, id DESC').all();
  res.json(meetings);
}));

router.post('/', handleRoute((req, res) => {
  const date = requireTitle(req.body.date, '회의 날짜를 입력해주세요.');
  const result = db.prepare('INSERT INTO meetings (date) VALUES (?)').run(date);
  res.status(201).json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(result.lastInsertRowid));
}));

router.get('/:id', handleRoute((req, res) => {
  const meeting = assertMeeting(req.params.id);
  const overall_items = db.prepare('SELECT * FROM meeting_overall_items WHERE meeting_id = ? ORDER BY position ASC, id ASC').all(meeting.id);
  const part_items = db.prepare('SELECT * FROM meeting_part_items WHERE meeting_id = ? ORDER BY position ASC, id ASC').all(meeting.id);
  const action_items = db.prepare('SELECT * FROM meeting_action_items WHERE meeting_id = ? ORDER BY position ASC, id ASC').all(meeting.id);
  res.json({ meeting, overall_items, part_items, action_items });
}));

router.delete('/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '회의록을 찾을 수 없습니다.' });
  res.status(204).send();
}));

// --- 전체 섹션 ---

router.post('/:meetingId/overall-items', handleRoute((req, res) => {
  const meetingId = req.params.meetingId;
  assertMeeting(meetingId);
  const content = requireTitle(req.body.content, '내용을 입력해주세요.');
  const kind = VALID_OVERALL_KINDS.has(req.body.kind) ? req.body.kind : 'share';
  const position = maxPosition('meeting_overall_items', meetingId) + 1;

  const result = db.prepare(`
    INSERT INTO meeting_overall_items (meeting_id, kind, content, position)
    VALUES (?, ?, ?, ?)
  `).run(meetingId, kind, content, position);

  res.status(201).json(db.prepare('SELECT * FROM meeting_overall_items WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/overall-items/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM meeting_overall_items WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  const content = req.body.content == null ? current.content : requireTitle(req.body.content, '내용을 입력해주세요.');
  const kind = req.body.kind == null
    ? current.kind
    : (VALID_OVERALL_KINDS.has(req.body.kind) ? req.body.kind : current.kind);

  db.prepare('UPDATE meeting_overall_items SET kind = ?, content = ? WHERE id = ?').run(kind, content, req.params.id);
  res.json(db.prepare('SELECT * FROM meeting_overall_items WHERE id = ?').get(req.params.id));
}));

router.delete('/overall-items/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM meeting_overall_items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  res.status(204).send();
}));

// --- 파트별 섹션 ---

router.post('/:meetingId/part-items', handleRoute((req, res) => {
  const meetingId = req.params.meetingId;
  assertMeeting(meetingId);
  const assignee = requireTitle(req.body.assignee, '담당자를 입력해주세요.');
  const progress = optionalText(req.body.progress);
  const request = optionalText(req.body.request);
  const position = maxPosition('meeting_part_items', meetingId) + 1;

  const result = db.prepare(`
    INSERT INTO meeting_part_items (meeting_id, assignee, progress, request, position)
    VALUES (?, ?, ?, ?, ?)
  `).run(meetingId, assignee, progress, request, position);

  res.status(201).json(db.prepare('SELECT * FROM meeting_part_items WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/part-items/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM meeting_part_items WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  const assignee = req.body.assignee == null ? current.assignee : requireTitle(req.body.assignee, '담당자를 입력해주세요.');
  const progress = req.body.progress == null ? current.progress : optionalText(req.body.progress);
  const request = req.body.request == null ? current.request : optionalText(req.body.request);

  db.prepare('UPDATE meeting_part_items SET assignee = ?, progress = ?, request = ? WHERE id = ?')
    .run(assignee, progress, request, req.params.id);
  res.json(db.prepare('SELECT * FROM meeting_part_items WHERE id = ?').get(req.params.id));
}));

router.delete('/part-items/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM meeting_part_items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  res.status(204).send();
}));

// --- 액션아이템 섹션 ---

router.post('/:meetingId/action-items', handleRoute((req, res) => {
  const meetingId = req.params.meetingId;
  assertMeeting(meetingId);
  const content = requireTitle(req.body.content, '내용을 입력해주세요.');
  const taskType = optionalText(req.body.task_type) ?? '기타';
  const status = req.body.status ?? '대기';
  if (!VALID_ACTION_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });
  const dueDate = optionalText(req.body.due_date);
  const assignee = optionalText(req.body.assignee);
  const position = maxPosition('meeting_action_items', meetingId) + 1;

  const result = db.prepare(`
    INSERT INTO meeting_action_items (meeting_id, task_type, content, status, due_date, assignee, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(meetingId, taskType, content, status, dueDate, assignee, position);

  res.status(201).json(db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/action-items/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  const content = req.body.content == null ? current.content : requireTitle(req.body.content, '내용을 입력해주세요.');
  const taskType = req.body.task_type == null ? current.task_type : (optionalText(req.body.task_type) ?? '기타');
  const status = req.body.status ?? current.status;
  if (!VALID_ACTION_STATUSES.has(status)) return res.status(400).json({ error: '올바른 상태가 아닙니다.' });
  const dueDate = req.body.due_date == null ? current.due_date : optionalText(req.body.due_date);
  const assignee = req.body.assignee == null ? current.assignee : optionalText(req.body.assignee);

  db.prepare(`
    UPDATE meeting_action_items SET task_type = ?, content = ?, status = ?, due_date = ?, assignee = ?
    WHERE id = ?
  `).run(taskType, content, status, dueDate, assignee, req.params.id);
  res.json(db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(req.params.id));
}));

router.delete('/action-items/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM meeting_action_items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  res.status(204).send();
}));

// Design Ref: §5 — 회의 원문을 서버로만 전달, 외부 AI 호출/키는 서비스 계층에 격리
router.post('/:meetingId/action-items/generate', handleRoute(async (req, res) => {
  const meetingId = req.params.meetingId;
  assertMeeting(meetingId);
  const notes = requireTitle(req.body.notes, '회의 원문을 입력해주세요.');

  const items = await generateActionItems(notes);

  let position = maxPosition('meeting_action_items', meetingId);
  const created = items.map((item) => {
    position += 1;
    const result = db.prepare(`
      INSERT INTO meeting_action_items (meeting_id, task_type, content, status, due_date, assignee, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(meetingId, item.task_type, item.content, item.status, item.due_date, item.assignee, position);
    return db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(result.lastInsertRowid);
  });

  res.status(201).json(created);
}));

module.exports = router;
