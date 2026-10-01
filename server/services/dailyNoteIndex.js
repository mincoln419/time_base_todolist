// 데일리노트 경량 인덱스 — 목록 페이지 나누기·필터, 캘린더 날짜별 개수, 마인드맵(태그 연결)은
// 본문 없이 제목·태그만 있으면 되므로, 노트마다 {date, item, keyword, category}만 문서 1건에 모아 둔다.
// Firestore는 읽은 문서 수로 과금되므로, 노트 N건을 각각 읽는 대신 이 문서 1건만 읽는다.
// 본문은 화면에 실제로 보여줄 노트만 id로 따로 읽는다.
const { firestore, FieldValue } = require('../db/firestore');
const { DAILY_NOTES, DAILY_NOTE_INDEX } = require('../db/collections');

const indexRef = firestore.collection(DAILY_NOTE_INDEX).doc('all');

// Firestore 문서 한도(1MiB)에 가까워지면 경고 — 노트당 수백 바이트라 수천 건까지는 여유가 있다.
const SIZE_WARN_BYTES = 800 * 1024;

function toEntry(note) {
  return {
    date: note.date,
    item: note.item ?? null,
    keyword: note.keyword ?? '',
    category: note.category ?? null,
  };
}

/** 노트 추가/수정과 같은 트랜잭션·배치 안에서 인덱스 항목을 쓴다. */
function setEntry(writer, note) {
  writer.set(indexRef, { entries: { [String(note.id)]: toEntry(note) } }, { merge: true });
}

function removeEntry(writer, id) {
  writer.set(indexRef, { entries: { [String(id)]: FieldValue.delete() } }, { merge: true });
}

/** 노트 전체를 한 번 읽어 인덱스를 새로 만든다 — 인덱스가 없거나(첫 사용) 백업 복원 뒤에만. */
async function rebuild() {
  const snap = await firestore.collection(DAILY_NOTES).get();
  const entries = {};
  snap.forEach((d) => {
    const note = d.data();
    entries[String(note.id)] = toEntry(note);
  });
  await indexRef.set({ built: true, entries });
  return entries;
}

/** 인덱스를 날짜 내림차순(같은 날은 최근 id 먼저) 배열로 돌려준다. */
async function listEntries() {
  const snap = await indexRef.get();
  const data = snap.exists ? snap.data() : null;
  const entries = data?.built ? data.entries ?? {} : await rebuild();
  if (Buffer.byteLength(JSON.stringify(entries)) > SIZE_WARN_BYTES) {
    console.warn('[dailyNoteIndex] 인덱스 문서가 1MiB 한도에 가까워지고 있습니다. 분할 저장을 검토하세요.');
  }
  return Object.entries(entries)
    .map(([id, e]) => ({ id: Number(id), ...e }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

/** 백업 복원 등으로 노트가 통째로 바뀐 뒤 호출 — 다음 조회 때 다시 만든다. */
async function invalidate() {
  await indexRef.delete();
}

module.exports = { setEntry, removeEntry, listEntries, invalidate };
