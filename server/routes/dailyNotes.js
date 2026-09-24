const express = require('express');
const { firestore } = require('../db/firestore');
const { DAILY_NOTES, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler, exceedsTextFieldLimit } = require('../db/util');
const { extractNoteTags } = require('../services/noteTags');

const router = express.Router();
const notesRef = firestore.collection(DAILY_NOTES);

function todayDateString() {
  return nowString().slice(0, 10);
}

// 해시태그 스타일 다중 키워드 — 쉼표로 구분된 토큰을 trim·중복 제거 후 다시 쉼표로 합친다
function normalizeKeyword(raw) {
  const tokens = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set(tokens)].join(', ');
}

// GET /api/daily-notes — 목록 조회 (date 또는 month 쿼리로 필터링, date 우선)
// month는 SQL의 LIKE 'YYYY-MM%' 대체용으로 비정규화해 저장한 필드.
router.get('/', asyncHandler(async (req, res) => {
  const { date, month } = req.query;
  let snap;
  if (date) {
    snap = await notesRef.where('date', '==', date).orderBy('id', 'desc').get();
  } else if (month) {
    snap = await notesRef.where('month', '==', month).orderBy('date', 'desc').orderBy('id', 'desc').get();
  } else {
    snap = await notesRef.orderBy('date', 'desc').orderBy('id', 'desc').get();
  }
  res.json(snap.docs.map((d) => d.data()));
}));

// POST /api/daily-notes — 새 노트 생성
router.post('/', asyncHandler(async (req, res) => {
  const keyword = normalizeKeyword(req.body.keyword);
  if (!keyword) return res.status(400).json({ error: '키워드를 1개 이상 입력해주세요.' });

  const content = req.body.content ?? '';
  if (exceedsTextFieldLimit(content)) {
    return res.status(400).json({ error: '내용이 너무 깁니다.' });
  }

  const date = (req.body.date || '').trim() || todayDateString();
  const category = (req.body.category || '').trim() || null;
  const item = (req.body.item || '').trim() || null;

  const note = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.DAILY_NOTES);
    const doc = {
      id, date, month: date.slice(0, 7), keyword, category, item, content,
      created_at: nowString(), updated_at: nowString(),
    };
    tx.set(notesRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(note);
}));

// POST /api/daily-notes/extract-tags — AI(Claude)로 본문에서 카테고리/키워드 추출
// DB에는 저장하지 않고 결과만 반환 — 클라이언트가 입력란에 채워 넣을지 사용자가 직접 결정
router.post('/extract-tags', async (req, res) => {
  try {
    res.json(await extractNoteTags(req.body.content));
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

// PUT /api/daily-notes/:id — 노트 수정 (전체 필드 upsert)
router.put('/:id', asyncHandler(async (req, res) => {
  const ref = notesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const keyword = normalizeKeyword(req.body.keyword);
  if (!keyword) return res.status(400).json({ error: '키워드를 1개 이상 입력해주세요.' });

  const content = req.body.content ?? '';
  if (exceedsTextFieldLimit(content)) {
    return res.status(400).json({ error: '내용이 너무 깁니다.' });
  }

  const date = (req.body.date || '').trim() || todayDateString();
  const category = (req.body.category || '').trim() || null;
  const item = (req.body.item || '').trim() || null;

  const updated = {
    ...snap.data(), date, month: date.slice(0, 7), keyword, category, item, content, updated_at: nowString(),
  };
  await ref.set(updated);
  res.json(updated);
}));

// DELETE /api/daily-notes/:id — 노트 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = notesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
