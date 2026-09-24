// 독서기록 파생값 계산 — 서버는 page_to만 저장하고 나머지는 모두 여기서 계산한다.
// 날짜는 항상 로컬 기준 YYYY-MM-DD 문자열로 다룬다(toISOString 사용 금지 — UTC로 하루 밀림).

export const DAILY_TARGET = 10;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayString() {
  return formatDate(new Date());
}

export function addDays(value, n) {
  const d = parseDate(value);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

export function logOn(book, date) {
  return book.logs.find((log) => log.date === date) ?? null;
}

export function currentPage(book) {
  const last = book.logs[book.logs.length - 1];
  return last ? last.page_to : book.start_page;
}

export function pageBefore(book, date) {
  let page = book.start_page;
  for (const log of book.logs) {
    if (log.date >= date) break;
    page = log.page_to;
  }
  return page;
}

export function pagesOn(book, date) {
  const log = logOn(book, date);
  return log ? log.page_to - pageBefore(book, date) : 0;
}

export function bookStatus(book, today) {
  if (book.finished_at) return 'done';
  if (book.start_date > today) return 'planned';
  return 'reading';
}

export function daysLeft(total, current, target = DAILY_TARGET) {
  return Math.max(0, Math.ceil((total - current) / target));
}

// 완독 예상일: 기준일(예정이면 시작일, 오늘 읽었으면 내일, 아니면 오늘)부터 남은 일수만큼
export function estimateFinish({ total, current, startDate, readToday }, today) {
  const left = daysLeft(total, current);
  if (left === 0) return null;
  let base = readToday ? addDays(today, 1) : today;
  if (startDate > today) base = startDate;
  return addDays(base, left - 1);
}

export function bookEta(book, today) {
  return estimateFinish({
    total: book.total_pages,
    current: currentPage(book),
    startDate: book.start_date,
    readToday: !!logOn(book, today),
  }, today);
}

// 시작일 ~ 어제(완독일 이전) 중 기록이 없는 날 수
export function missedDays(book, today) {
  let end = addDays(today, -1);
  if (book.finished_at && book.finished_at < end) end = book.finished_at;
  if (book.start_date > end) return 0;
  const span = daysBetween(book.start_date, end) + 1;
  const logged = book.logs.filter((log) => log.date >= book.start_date && log.date <= end).length;
  return Math.max(0, span - logged);
}

// 날짜별 전체 책 합계 — 잔디 히트맵용
export function dailyTotals(books) {
  const totals = new Map();
  for (const book of books) {
    let prev = book.start_page;
    for (const log of book.logs) {
      const pages = log.page_to - prev;
      prev = log.page_to;
      const entry = totals.get(log.date) ?? { pages: 0, items: [] };
      entry.pages += pages;
      entry.items.push({ title: book.title, pages });
      totals.set(log.date, entry);
    }
  }
  return totals;
}
