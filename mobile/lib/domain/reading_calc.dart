import 'book.dart';
import 'date_key.dart';

/// 책의 진행 상태.
enum BookStatus { planned, reading, done }

/// 잔디 한 칸에 들어가는 책별 내역.
class DailyItem {
  const DailyItem({required this.bookId, required this.title, required this.pages, required this.target});

  final String bookId;
  final String title;
  final int pages;
  final int target;

  bool get belowTarget => pages < target;
}

/// 하루치 합계 (전체 책).
class DailyTotal {
  DailyTotal() : items = [];

  int pages = 0;
  final List<DailyItem> items;
}

/// 독서기록 파생값 계산 — 웹 `client/src/utils/readingCalc.js`를 1:1로 옮긴 순수 함수 모음.
/// 같은 입력이면 웹과 같은 결과가 나와야 한다(Design §4.2, §11.1).
abstract final class ReadingCalc {
  /// 마지막 기록의 페이지, 기록이 없으면 등록 시점 페이지.
  static int currentPage(Book book) => book.logs.isEmpty ? book.startPage : book.logs.values.last;

  /// [date] 이전 마지막 기록의 페이지, 없으면 등록 시점 페이지.
  static int pageBefore(Book book, DateKey date) {
    var page = book.startPage;
    for (final entry in book.logs.entries) {
      if (entry.key >= date) break;
      page = entry.value;
    }
    return page;
  }

  /// [date] 이후 첫 기록의 페이지, 없으면 null.
  static int? pageAfter(Book book, DateKey date) {
    for (final entry in book.logs.entries) {
      if (entry.key > date) return entry.value;
    }
    return null;
  }

  /// 그날 읽은 페이지 수 (기록이 없으면 0).
  static int pagesOn(Book book, DateKey date) {
    final pageTo = book.logs[date];
    return pageTo == null ? 0 : pageTo - pageBefore(book, date);
  }

  static bool hasLogOn(Book book, DateKey date) => book.logs.containsKey(date);

  static BookStatus status(Book book, DateKey today) {
    if (book.finishedAt != null) return BookStatus.done;
    if (book.startDate > today) return BookStatus.planned;
    return BookStatus.reading;
  }

  static double progress(Book book) => currentPage(book) / book.totalPages;

  static int daysLeft(int total, int current, int target) {
    final left = total - current;
    if (left <= 0) return 0;
    return (left + target - 1) ~/ target;
  }

  static int bookDaysLeft(Book book) => daysLeft(book.totalPages, currentPage(book), book.dailyTarget);

  /// 완독 예상일: 기준일(예정이면 시작일, 오늘 읽었으면 내일, 아니면 오늘)부터 남은 일수만큼.
  /// 남은 페이지가 없으면 null.
  static DateKey? estimateFinish({
    required int total,
    required int current,
    required int target,
    required DateKey startDate,
    required bool readToday,
    required DateKey today,
  }) {
    final left = daysLeft(total, current, target);
    if (left == 0) return null;
    var base = readToday ? today.addDays(1) : today;
    if (startDate > today) base = startDate;
    return base.addDays(left - 1);
  }

  static DateKey? bookEta(Book book, DateKey today) => estimateFinish(
        total: book.totalPages,
        current: currentPage(book),
        target: book.dailyTarget,
        startDate: book.startDate,
        readToday: hasLogOn(book, today),
        today: today,
      );

  /// 반납일까지 끝내기 위한 하루 목표. 오늘(오늘 이미 읽었으면 내일, 예정 책이면 시작일)부터
  /// 반납일까지 남은 날로 남은 페이지를 나눈다. 반납일이 이미 지났으면 null.
  static int? targetForDueDate({
    required int total,
    required int current,
    required DateKey startDate,
    required DateKey dueDate,
    required bool readToday,
    required DateKey today,
  }) {
    var from = readToday ? today.addDays(1) : today;
    if (startDate > from) from = startDate;
    final available = from.daysUntil(dueDate) + 1;
    if (available < 1) return null;
    final remaining = total - current;
    if (remaining <= 0) return 1;
    final target = (remaining + available - 1) ~/ available;
    return target < 1 ? 1 : target;
  }

  /// 예상 완독일이 반납일을 넘는지.
  static bool isOverdue(Book book, DateKey today) {
    final due = book.dueDate;
    final eta = bookEta(book, today);
    return due != null && eta != null && eta > due;
  }

  /// 시작일 ~ 어제(완독일 이후 제외) 중 기록이 없는 날 수.
  static int missedDays(Book book, DateKey today) {
    var end = today.addDays(-1);
    final finished = book.finishedAt;
    if (finished != null && finished < end) end = finished;
    if (book.startDate > end) return 0;
    final span = book.startDate.daysUntil(end) + 1;
    final logged = book.logs.keys.where((d) => d >= book.startDate && d <= end).length;
    final missed = span - logged;
    return missed < 0 ? 0 : missed;
  }

  /// 총 페이지에 처음 도달한 기록의 날짜, 없으면 등록 시점에 이미 끝난 경우 시작일, 아니면 null.
  static DateKey? computeFinishedAt(Book book) {
    for (final entry in book.logs.entries) {
      if (entry.value >= book.totalPages) return entry.key;
    }
    return book.startPage >= book.totalPages ? book.startDate : null;
  }

  /// 기록을 추가/수정한 책 (완독일 재계산 포함). 검증은 [LogValidator]가 먼저 한다.
  static Book withLog(Book book, DateKey date, int pageTo) {
    final next = book.copyWith(logs: {...book.logs, date: pageTo});
    return next.copyWith(finishedAt: () => computeFinishedAt(next));
  }

  /// 기록을 지운 책 (완독일 재계산 포함).
  static Book withoutLog(Book book, DateKey date) {
    final next = book.copyWith(logs: Map.of(book.logs)..remove(date));
    return next.copyWith(finishedAt: () => computeFinishedAt(next));
  }

  /// 날짜별 전체 책 합계 — 잔디 히트맵용.
  static Map<DateKey, DailyTotal> dailyTotals(Iterable<Book> books) {
    final totals = <DateKey, DailyTotal>{};
    for (final book in books) {
      var prev = book.startPage;
      for (final entry in book.logs.entries) {
        final pages = entry.value - prev;
        prev = entry.value;
        final total = totals.putIfAbsent(entry.key, DailyTotal.new);
        total.pages += pages;
        total.items.add(DailyItem(bookId: book.id, title: book.title, pages: pages, target: book.dailyTarget));
      }
    }
    return totals;
  }

  /// 연속 독서일 — 오늘 기록이 없으면 어제부터 센다.
  static int streak(Map<DateKey, DailyTotal> totals, DateKey today) {
    var day = totals.containsKey(today) ? today : today.addDays(-1);
    var count = 0;
    while (totals.containsKey(day)) {
      count += 1;
      day = day.addDays(-1);
    }
    return count;
  }

  /// [date]의 체크리스트에 나오는 책 — 시작했고, 그 날짜 이전에 완독하지 않은 책.
  static bool isOnChecklist(Book book, DateKey date) {
    final finished = book.finishedAt;
    return book.startDate <= date && (finished == null || finished >= date);
  }
}
