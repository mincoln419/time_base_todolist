const express = require('express');
const { firestore } = require('../db/firestore');
const { WORRIES, WORRY_ATTEMPTS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const worriesRef = firestore.collection(WORRIES);
const MAX_CONCLUSION_LENGTH = 2000;

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function worryExistsOnDate(worry, date) {
  const created = dateOnly(worry.created_at);
  const completed = dateOnly(worry.completed_at);
  return created <= date && (!completed || completed >= date);
}

// GET /api/worries - 전체 고민 목록 (데이터 양이 적어 전체 로드 후 JS에서 정렬/필터)
router.get('/', asyncHandler(async (req, res) => {
  const snap = await worriesRef.get();
  const rows = snap.docs.map((d) => d.data());

  const active = rows
    .filter((w) => w.completed_at == null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const completed = rows
    .filter((w) => w.completed_at != null)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at) || b.id - a.id);

  res.json({ active, completed });
}));

// POST /api/worries - 고민 추가
router.post('/', asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '고민할 내용을 입력해주세요.' });
  }

  const worry = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.WORRIES);
    const doc = { id, title: title.trim(), created_at: nowString(), conclusion: null, completed_at: null };
    tx.set(worriesRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(worry);
}));

// PATCH /api/worries/:id/complete - 완료 목록으로 이동
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const ref = worriesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const conclusion = String(req.body?.conclusion ?? '').trim();
  if (conclusion.length > MAX_CONCLUSION_LENGTH) {
    return res.status(400).json({ error: '메모는 2000자 이내로 입력해주세요.' });
  }

  const current = snap.data();
  const updated = { ...current, conclusion: conclusion || null, completed_at: current.completed_at || nowString() };
  await ref.set(updated);
  res.json(updated);
}));

// PATCH /api/worries/:id/conclusion - 고민의 메모 저장/수정
router.patch('/:id/conclusion', asyncHandler(async (req, res) => {
  const ref = worriesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const conclusion = String(req.body?.conclusion ?? '').trim();
  if (conclusion.length > MAX_CONCLUSION_LENGTH) {
    return res.status(400).json({ error: '메모는 2000자 이내로 입력해주세요.' });
  }

  const updated = { ...snap.data(), conclusion: conclusion || null };
  await ref.set(updated);
  res.json(updated);
}));

// PATCH /api/worries/:id/restore - 완료된 고민을 활성 목록으로 복원
router.patch('/:id/restore', asyncHandler(async (req, res) => {
  const ref = worriesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const updated = { ...snap.data(), completed_at: null };
  await ref.set(updated);
  res.json(updated);
}));

// GET /api/worries/daily?date=YYYY-MM-DD - 특정 날짜의 체크 표
router.get('/daily', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!isDateString(date)) return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });

  const worriesSnap = await worriesRef.get();
  const worries = worriesSnap.docs.map((d) => d.data()).filter((w) => worryExistsOnDate(w, date));
  worries.sort((a, b) => {
    const aDone = a.completed_at != null ? 1 : 0;
    const bDone = b.completed_at != null ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return a.created_at.localeCompare(b.created_at) || a.id - b.id;
  });

  const attemptsSnap = await firestore.collectionGroup(WORRY_ATTEMPTS).where('date', '==', date).get();
  const attemptedIds = new Set(
    attemptsSnap.docs.filter((d) => d.data().attempted === 1).map((d) => d.data().worry_id)
  );

  const rows = worries.map((w) => ({
    id: w.id,
    title: w.title,
    created_at: w.created_at,
    completed_at: w.completed_at,
    attempted: attemptedIds.has(w.id) ? 1 : 0,
  }));

  res.json({
    date,
    worries: rows,
    stats: {
      attempted: rows.filter((row) => row.attempted === 1).length,
      total: rows.length,
    },
  });
}));

// PUT /api/worries/:id/attempts/:date - 날짜별 해결 시도 체크
router.put('/:id/attempts/:date', asyncHandler(async (req, res) => {
  const { id, date } = req.params;
  const attempted = req.body.attempted ? 1 : 0;

  if (!isDateString(date)) return res.status(400).json({ error: '올바른 날짜가 아닙니다.' });

  const worrySnap = await worriesRef.doc(id).get();
  if (!worrySnap.exists) throw new NotFoundError();
  if (!worryExistsOnDate(worrySnap.data(), date)) {
    return res.status(400).json({ error: '해당 날짜의 고민 목록에 포함되지 않습니다.' });
  }

  const attemptRef = worriesRef.doc(id).collection(WORRY_ATTEMPTS).doc(date);
  if (attempted) {
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(attemptRef);
      if (!snap.exists) {
        tx.set(attemptRef, { worry_id: Number(id), date, attempted: 1, created_at: nowString() });
      } else {
        tx.update(attemptRef, { attempted: 1 });
      }
    });
  } else {
    await attemptRef.delete();
  }

  res.json({ worry_id: Number(id), date, attempted });
}));

// GET /api/worries/stats?year=YYYY&month=1-12 - 캘린더 배지 통계
router.get('/stats', asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year와 month 파라미터가 필요합니다.' });
  }

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const worriesSnap = await worriesRef.get();
  const worries = worriesSnap.docs
    .map((d) => d.data())
    .filter((w) => dateOnly(w.created_at) <= monthEnd && (!w.completed_at || dateOnly(w.completed_at) >= monthStart));

  const attemptsSnap = await firestore
    .collectionGroup(WORRY_ATTEMPTS)
    .where('attempted', '==', 1)
    .where('date', '>=', monthStart)
    .where('date', '<=', monthEnd)
    .get();

  const attemptedByDate = {};
  attemptsSnap.forEach((d) => {
    const a = d.data();
    (attemptedByDate[a.date] ??= new Set()).add(a.worry_id);
  });

  const stats = [];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const total = worries.filter((w) => worryExistsOnDate(w, date)).length;
    const attempted = worries.filter(
      (w) => worryExistsOnDate(w, date) && attemptedByDate[date]?.has(w.id)
    ).length;
    stats.push({ date, attempted, total });
  }

  res.json({ year, month, stats });
}));

module.exports = router;
