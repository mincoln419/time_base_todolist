const express = require('express');
const { firestore } = require('../db/firestore');
const { DAILY_NOTES, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler, exceedsTextFieldLimit } = require('../db/util');
const { extractNoteTags } = require('../services/noteTags');
const noteIndex = require('../services/dailyNoteIndex');

// 한 번에 본문까지 읽을 수 있는 노트 수 (목록 한 페이지·마인드맵 선택 이웃 등) — 과도한 읽기 방지용 기술 한도
const MAX_IDS_PER_REQUEST = 50;

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

// GET /api/daily-notes/index — 제목·태그만 담은 경량 목록 (문서 1건 읽기)
router.get('/index', asyncHandler(async (req, res) => {
  res.json(await noteIndex.listEntries());
}));

// GET /api/daily-notes — 본문 포함 조회. ids(쉼표 구분) 우선, 그다음 date 또는 month 필터.
// 필터 없이 전체를 읽는 요청은 노트 수만큼 읽기가 나가므로 받지 않는다(목록은 /index + ids로).
// month는 SQL의 LIKE 'YYYY-MM%' 대체용으로 비정규화해 저장한 필드.
router.get('/', asyncHandler(async (req, res) => {
  const { date, month, ids } = req.query;
  if (ids) {
    const list = String(ids).split(',').map((v) => v.trim()).filter(Boolean);
    if (list.length > MAX_IDS_PER_REQUEST) {
      return res.status(400).json({ error: `한 번에 ${MAX_IDS_PER_REQUEST}개까지 조회할 수 있습니다.` });
    }
    if (list.length === 0) return res.json([]);
    const snaps = await firestore.getAll(...list.map((id) => notesRef.doc(id)));
    return res.json(snaps.filter((s) => s.exists).map((s) => s.data()));
  }
  if (!date && !month) {
    return res.status(400).json({ error: 'ids, date 또는 month 파라미터가 필요합니다.' });
  }
  let snap;
  if (date) {
    snap = await notesRef.where('date', '==', date).orderBy('id', 'desc').get();
  } else {
    snap = await notesRef.where('month', '==', month).orderBy('date', 'desc').orderBy('id', 'desc').get();
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
    noteIndex.setEntry(tx, doc);
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
  const batch = firestore.batch();
  batch.set(ref, updated);
  noteIndex.setEntry(batch, updated);
  await batch.commit();
  res.json(updated);
}));

// DELETE /api/daily-notes/:id — 노트 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = notesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  const batch = firestore.batch();
  batch.delete(ref);
  noteIndex.removeEntry(batch, req.params.id);
  await batch.commit();
  res.status(204).send();
}));

module.exports = router;
