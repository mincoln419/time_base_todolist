const express = require('express');
const { firestore } = require('../db/firestore');
const { NOTIFICATION_WEBHOOKS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const webhooksRef = firestore.collection(NOTIFICATION_WEBHOOKS);

// GET /api/webhooks — 등록된 알림 웹훅 전체 조회
router.get('/', asyncHandler(async (req, res) => {
  const snap = await webhooksRef.orderBy('id', 'asc').get();
  res.json(snap.docs.map((d) => d.data()));
}));

// POST /api/webhooks — 웹훅 등록
router.post('/', asyncHandler(async (req, res) => {
  const { name, url } = req.body;
  if (!name || !name.trim() || !url || !url.trim()) {
    return res.status(400).json({ error: '이름과 URL을 입력해주세요.' });
  }

  const webhook = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.NOTIFICATION_WEBHOOKS);
    const doc = { id, name: name.trim(), url: url.trim(), enabled: 1, created_at: nowString() };
    tx.set(webhooksRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(webhook);
}));

// PUT /api/webhooks/:id — 이름/URL/활성화 여부 수정
router.put('/:id', asyncHandler(async (req, res) => {
  const { name, url, enabled } = req.body;
  const ref = webhooksRef.doc(req.params.id);

  const current = (await ref.get()).data();
  if (!current) throw new NotFoundError();

  if (name != null && !name.trim()) {
    return res.status(400).json({ error: '이름은 비워둘 수 없습니다.' });
  }
  if (url != null && !url.trim()) {
    return res.status(400).json({ error: 'URL은 비워둘 수 없습니다.' });
  }

  const updated = {
    ...current,
    name: name != null ? name.trim() : current.name,
    url: url != null ? url.trim() : current.url,
    enabled: enabled != null ? (enabled ? 1 : 0) : current.enabled,
  };
  await ref.set(updated);

  res.json(updated);
}));

// DELETE /api/webhooks/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = webhooksRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
