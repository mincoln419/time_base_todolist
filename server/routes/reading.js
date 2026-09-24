const express = require('express');
const { firestore } = require('../db/firestore');
const { READING_BOOKS, READING_LOGS, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const booksRef = firestore.collection(READING_BOOKS);
const logsRef = firestore.collection(READING_LOGS);
const DEFAULT_DAILY_TARGET = 10;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
}

function todayString() {
  return nowString().slice(0, 10);
}

function toPage(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function logId(bookId, date) {
  return `${bookId}_${date}`;
}

function sortLogs(logs) {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

// 총 페이지에 처음 도달한 기록의 날짜 — 기록이 없으면 등록 시점 페이지로 판단
function computeFinishedAt(book, logs) {
  const hit = logs.find((log) => log.page_to >= book.total_pages);
  if (hit) return hit.date;
  return book.start_page >= book.total_pages ? book.start_date : null;
}

function withLogs(book, logs) {
  return { ...book, logs: logs.map(({ date, page_to }) => ({ date, page_to })) };
}

async function loadBookWithLogs(tx, id) {
  const bookSnap = await tx.get(booksRef.doc(String(id)));
  if (!bookSnap.exists) throw new NotFoundError();
  const logsSnap = await tx.get(logsRef.where('book_id', '==', Number(id)));
  return { book: bookSnap.data(), logs: sortLogs(logsSnap.docs.map((d) => d.data())) };
}

// POST/PATCH 공통 필드 검증 — current는 기존 책(PATCH)일 때만 전달
function validateBookFields(body, current) {
  const title = body.title !== undefined ? String(body.title).trim() : current?.title;
  if (!title) throw badRequest('책 제목을 입력해주세요.');

  const total = toPage(body.total_pages, current?.total_pages);
  if (!Number.isInteger(total) || total < 1) throw badRequest('총 페이지는 1 이상의 정수로 입력해주세요.');

  const start = toPage(body.start_page, current?.start_page ?? 0);
  if (!Number.isInteger(start) || start < 0 || start > total) {
    throw badRequest('현재 페이지는 0 ~ 총 페이지 사이로 입력해주세요.');
  }

  const startDate = body.start_date || current?.start_date || todayString();
  if (!isDateString(startDate)) throw badRequest('시작일 형식이 올바르지 않습니다.');

  const target = toPage(body.daily_target, current?.daily_target ?? DEFAULT_DAILY_TARGET);
  if (!Number.isInteger(target) || target < 1) throw badRequest('하루 목표 페이지는 1 이상의 정수로 입력해주세요.');

  // 반납일(선택) — 도서관 책처럼 기한이 있을 때만 입력
  const dueDate = body.due_date !== undefined ? (body.due_date || null) : (current?.due_date ?? null);
  if (dueDate !== null && !isDateString(dueDate)) throw badRequest('반납일 형식이 올바르지 않습니다.');
  if (dueDate !== null && dueDate < startDate) throw badRequest('반납일은 시작일 이후로 입력해주세요.');

  return { title, total_pages: total, start_page: start, start_date: startDate, daily_target: target, due_date: dueDate };
}

// GET /api/reading/books - 전체 책 + 기록 (데이터 양이 적어 전체 로드)
router.get('/books', asyncHandler(async (req, res) => {
  const [booksSnap, logsSnap] = await Promise.all([booksRef.get(), logsRef.get()]);
  const logsByBook = new Map();
  logsSnap.forEach((d) => {
    const log = d.data();
    if (!logsByBook.has(log.book_id)) logsByBook.set(log.book_id, []);
    logsByBook.get(log.book_id).push(log);
  });

  const books = booksSnap.docs
    .map((d) => d.data())
    .sort((a, b) => a.id - b.id)
    .map((book) => withLogs(book, sortLogs(logsByBook.get(book.id) ?? [])));

  res.json({ books });
}));

// POST /api/reading/books - 책 추가
router.post('/books', asyncHandler(async (req, res) => {
  const fields = validateBookFields(req.body ?? {});

  const book = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.READING_BOOKS);
    const now = nowString();
    const doc = { id, ...fields, finished_at: null, created_at: now, updated_at: now };
    doc.finished_at = computeFinishedAt(doc, []);
    tx.set(booksRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(withLogs(book, []));
}));

// PATCH /api/reading/books/:id - 책 정보 수정
router.patch('/books/:id', asyncHandler(async (req, res) => {
  const result = await firestore.runTransaction(async (tx) => {
    const { book, logs } = await loadBookWithLogs(tx, req.params.id);
    const fields = validateBookFields(req.body ?? {}, book);

    const first = logs[0];
    const last = logs[logs.length - 1];
    if (first && fields.start_page > first.page_to) throw badRequest('시작 페이지가 이미 기록된 페이지보다 큽니다.');
    if (last && fields.total_pages < last.page_to) throw badRequest('총 페이지가 이미 읽은 페이지보다 작습니다.');
    if (first && fields.start_date > first.date) throw badRequest('시작일 이전의 기록이 있습니다.');

    const updated = { ...book, ...fields, updated_at: nowString() };
    updated.finished_at = computeFinishedAt(updated, logs);
    tx.set(booksRef.doc(String(book.id)), updated);
    return withLogs(updated, logs);
  });

  res.json(result);
}));

// DELETE /api/reading/books/:id - 책과 그 기록 삭제
router.delete('/books/:id', asyncHandler(async (req, res) => {
  const ref = booksRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const logsSnap = await logsRef.where('book_id', '==', Number(req.params.id)).get();
  const batch = firestore.batch();
  logsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
  res.status(204).end();
}));

// PUT /api/reading/books/:id/logs/:date - 그날 도달 페이지 기록(체크)
router.put('/books/:id/logs/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDateString(date)) throw badRequest('올바른 날짜가 아닙니다.');
  const pageTo = toPage(req.body?.page_to, NaN);

  const result = await firestore.runTransaction(async (tx) => {
    const { book, logs } = await loadBookWithLogs(tx, req.params.id);
    if (date < book.start_date || date > todayString()) {
      throw badRequest('시작일부터 오늘까지만 기록할 수 있습니다.');
    }

    // 날짜순으로 페이지가 단조 증가하도록 앞뒤 기록 사이 값만 허용
    const others = logs.filter((log) => log.date !== date);
    const prev = others.filter((log) => log.date < date).pop();
    const next = others.find((log) => log.date > date);
    const before = prev ? prev.page_to : book.start_page;
    if (!Number.isInteger(pageTo) || pageTo <= before || pageTo > book.total_pages) {
      throw badRequest(`이전 기록(${before}p)보다 크고 총 페이지 이하로 입력해주세요.`);
    }
    if (next && pageTo > next.page_to) throw badRequest(`이후 기록(${next.page_to}p)보다 클 수 없습니다.`);

    const now = nowString();
    const existing = logs.find((log) => log.date === date);
    const log = {
      id: logId(book.id, date),
      book_id: book.id,
      date,
      page_to: pageTo,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const nextLogs = sortLogs([...others, log]);
    const updated = { ...book, finished_at: computeFinishedAt(book, nextLogs), updated_at: now };

    tx.set(logsRef.doc(log.id), log);
    tx.set(booksRef.doc(String(book.id)), updated);
    return withLogs(updated, nextLogs);
  });

  res.json(result);
}));

// DELETE /api/reading/books/:id/logs/:date - 그날 기록 삭제(체크 해제)
router.delete('/books/:id/logs/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;

  await firestore.runTransaction(async (tx) => {
    const { book, logs } = await loadBookWithLogs(tx, req.params.id);
    if (!logs.some((log) => log.date === date)) throw new NotFoundError();

    const nextLogs = logs.filter((log) => log.date !== date);
    tx.delete(logsRef.doc(logId(book.id, date)));
    tx.set(booksRef.doc(String(book.id)), {
      ...book,
      finished_at: computeFinishedAt(book, nextLogs),
      updated_at: nowString(),
    });
  });

  res.status(204).end();
}));

module.exports = router;
