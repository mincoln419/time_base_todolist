const express = require('express');
const db = require('../db/database');

const router = express.Router();

function requireTitle(value, message) {
  const title = String(value ?? '').trim();
  if (!title) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
  return title;
}

function handleRoute(fn) {
  return (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  };
}

function assertRail(id) {
  const rail = db.prepare('SELECT * FROM warroom_rails WHERE id = ?').get(id);
  if (!rail) {
    const err = new Error('레일을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return rail;
}

function assertMember(id) {
  const member = db.prepare('SELECT * FROM warroom_members WHERE id = ?').get(id);
  if (!member) {
    const err = new Error('인원을 찾을 수 없습니다.');
    err.status = 404;
    throw err;
  }
  return member;
}

function maxPosition(table) {
  return db.prepare(`SELECT COALESCE(MAX(position), -1) AS p FROM ${table}`).get().p;
}

function maxMemberTaskPosition(memberId) {
  return db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM warroom_member_tasks WHERE member_id = ?')
    .get(memberId).p;
}

function loadBoard() {
  const rails = db.prepare('SELECT * FROM warroom_rails ORDER BY position ASC, id ASC').all();
  const members = db.prepare('SELECT * FROM warroom_members ORDER BY position ASC, id ASC').all();
  const tasks = db.prepare('SELECT * FROM warroom_member_tasks ORDER BY position ASC, id ASC').all();

  const tasksByMember = tasks.reduce((acc, task) => {
    (acc[task.member_id] ??= []).push(task);
    return acc;
  }, {});

  return {
    rails,
    members: members.map((member) => ({
      ...member,
      tasks: tasksByMember[member.id] ?? [],
    })),
  };
}

router.get('/', handleRoute((req, res) => {
  res.json(loadBoard());
}));

router.post('/rails', handleRoute((req, res) => {
  const name = requireTitle(req.body.name, '레일 이름을 입력해주세요.');
  const position = maxPosition('warroom_rails') + 1;

  const result = db.prepare('INSERT INTO warroom_rails (name, position) VALUES (?, ?)').run(name, position);
  res.status(201).json(db.prepare('SELECT * FROM warroom_rails WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/rails/:id', handleRoute((req, res) => {
  const current = assertRail(req.params.id);
  const name = req.body.name == null ? current.name : requireTitle(req.body.name, '레일 이름을 입력해주세요.');

  db.prepare('UPDATE warroom_rails SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json(db.prepare('SELECT * FROM warroom_rails WHERE id = ?').get(req.params.id));
}));

router.post('/rails/:id/move', handleRoute((req, res) => {
  const current = assertRail(req.params.id);
  const direction = req.body.direction;
  if (direction !== 'up' && direction !== 'down') {
    const err = new Error('올바른 이동 방향이 아닙니다.');
    err.status = 400;
    throw err;
  }

  const neighbor = direction === 'up'
    ? db.prepare('SELECT * FROM warroom_rails WHERE position < ? ORDER BY position DESC LIMIT 1').get(current.position)
    : db.prepare('SELECT * FROM warroom_rails WHERE position > ? ORDER BY position ASC LIMIT 1').get(current.position);

  if (!neighbor) return res.status(204).send();

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE warroom_rails SET position = ? WHERE id = ?').run(neighbor.position, current.id);
    db.prepare('UPDATE warroom_rails SET position = ? WHERE id = ?').run(current.position, neighbor.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.status(204).send();
}));

router.delete('/rails/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM warroom_rails WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '레일을 찾을 수 없습니다.' });
  res.status(204).send();
}));

router.post('/members', handleRoute((req, res) => {
  const name = requireTitle(req.body.name, '이름을 입력해주세요.');
  const position = maxPosition('warroom_members') + 1;

  const result = db.prepare('INSERT INTO warroom_members (name, position) VALUES (?, ?)').run(name, position);
  const member = db.prepare('SELECT * FROM warroom_members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...member, tasks: [] });
}));

router.patch('/members/:id', handleRoute((req, res) => {
  const current = assertMember(req.params.id);
  const railId = 'rail_id' in req.body ? req.body.rail_id : current.rail_id;
  if (railId != null) assertRail(railId);

  db.prepare('UPDATE warroom_members SET rail_id = ? WHERE id = ?').run(railId, req.params.id);
  const member = db.prepare('SELECT * FROM warroom_members WHERE id = ?').get(req.params.id);
  const tasks = db.prepare('SELECT * FROM warroom_member_tasks WHERE member_id = ? ORDER BY position ASC, id ASC').all(req.params.id);
  res.json({ ...member, tasks });
}));

router.delete('/members/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM warroom_members WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '인원을 찾을 수 없습니다.' });
  res.status(204).send();
}));

router.post('/members/:id/tasks', handleRoute((req, res) => {
  const memberId = req.params.id;
  assertMember(memberId);
  const title = requireTitle(req.body.title, '업무명을 입력해주세요.');
  const position = maxMemberTaskPosition(memberId) + 1;

  const result = db.prepare(`
    INSERT INTO warroom_member_tasks (member_id, title, position)
    VALUES (?, ?, ?)
  `).run(memberId, title, position);

  res.status(201).json(db.prepare('SELECT * FROM warroom_member_tasks WHERE id = ?').get(result.lastInsertRowid));
}));

router.patch('/member-tasks/:id', handleRoute((req, res) => {
  const current = db.prepare('SELECT * FROM warroom_member_tasks WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '업무 태그를 찾을 수 없습니다.' });

  const isPrimary = req.body.is_primary == null ? current.is_primary : (req.body.is_primary ? 1 : 0);
  db.exec('BEGIN');
  try {
    if (isPrimary === 1) {
      db.prepare('UPDATE warroom_member_tasks SET is_primary = 0 WHERE member_id = ? AND id != ?')
        .run(current.member_id, req.params.id);
    }
    db.prepare('UPDATE warroom_member_tasks SET is_primary = ? WHERE id = ?').run(isPrimary, req.params.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json(db.prepare('SELECT * FROM warroom_member_tasks WHERE id = ?').get(req.params.id));
}));

router.delete('/member-tasks/:id', handleRoute((req, res) => {
  const result = db.prepare('DELETE FROM warroom_member_tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '업무 태그를 찾을 수 없습니다.' });
  res.status(204).send();
}));

module.exports = router;
