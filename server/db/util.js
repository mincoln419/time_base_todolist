const { firestore } = require('./firestore');
const { COUNTERS } = require('./collections');

// SQLite의 datetime('now','localtime')과 동일한 포맷("YYYY-MM-DD HH:MM:SS", 로컬 타임)을
// 재현한다 — 응답 JSON의 timestamp 필드 shape을 그대로 유지하기 위해 Firestore Timestamp
// 대신 이 문자열 포맷을 그대로 저장한다.
function nowString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// _counters/{counterKey} 문서를 트랜잭션 안에서 count만큼 증가시켜 새 정수 id들을 한번에
// 발급한다. 같은 카운터에 대해 nextId를 한 트랜잭션 안에서 두 번 호출하면 안 된다 —
// Firestore 트랜잭션은 이미 쓴 문서를 다시 읽으면 예외를 던지므로, 여러 개가 필요하면
// (예: 회의록 액션아이템 일괄 생성) 반드시 이 함수로 한 번에 받아야 한다.
// 호출부에서는 같은 트랜잭션 안에서 다른 읽기를 먼저 끝낸 뒤 호출해야 한다
// (Firestore 트랜잭션은 쓰기 이후의 읽기를 허용하지 않는다).
async function nextIds(tx, counterKey, count) {
  const ref = firestore.collection(COUNTERS).doc(counterKey);
  const snap = await tx.get(ref);
  const start = (snap.exists ? snap.data().value : 0) + 1;
  tx.set(ref, { value: start + count - 1 });
  return Array.from({ length: count }, (_, i) => start + i);
}

async function nextId(tx, counterKey) {
  const [id] = await nextIds(tx, counterKey, 1);
  return id;
}

class NotFoundError extends Error {
  constructor(message = '찾을 수 없습니다.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message = '이미 존재합니다.') {
    super(message);
    this.name = 'ConflictError';
  }
}

// async 라우트 핸들러를 감싸 NotFoundError/ConflictError를 각각 404/409로 매핑하고,
// (longgoals.js처럼) 일반 Error에 .status가 붙어 던져진 경우도 그 상태코드로 응답한다.
// 그 외 예외는 index.js의 공통 에러 미들웨어로 넘긴다.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof ConflictError) return res.status(409).json({ error: err.message });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    });
  };
}

module.exports = { nowString, nextId, nextIds, NotFoundError, ConflictError, asyncHandler };
