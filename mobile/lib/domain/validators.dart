import 'book.dart';
import 'date_key.dart';
import 'reading_calc.dart';

/// 도메인 검증 실패 사유. UI에서 ARB 메시지로 매핑한다(Design §4.3).
sealed class ValidationError {
  const ValidationError();
}

class TitleRequired extends ValidationError {
  const TitleRequired();
}

class InvalidTotalPages extends ValidationError {
  const InvalidTotalPages();
}

class InvalidStartPage extends ValidationError {
  const InvalidStartPage();
}

class InvalidDailyTarget extends ValidationError {
  const InvalidDailyTarget();
}

class DueBeforeStart extends ValidationError {
  const DueBeforeStart();
}

/// 수정 시 시작 페이지가 이미 기록된 첫 페이지보다 큼.
class StartPageAfterLogs extends ValidationError {
  const StartPageAfterLogs(this.firstLoggedPage);
  final int firstLoggedPage;
}

/// 수정 시 총 페이지가 이미 기록된 마지막 페이지보다 작음.
class TotalBelowLogs extends ValidationError {
  const TotalBelowLogs(this.lastLoggedPage);
  final int lastLoggedPage;
}

/// 수정 시 시작일 이전 날짜의 기록이 있음.
class StartDateAfterLogs extends ValidationError {
  const StartDateAfterLogs(this.firstLoggedDate);
  final DateKey firstLoggedDate;
}

/// 기록 날짜가 시작일 ~ 오늘 범위를 벗어남.
class LogDateOutOfRange extends ValidationError {
  const LogDateOutOfRange();
}

/// 기록 페이지가 이전 기록(또는 시작 페이지) 이하.
class NotAfterPrevious extends ValidationError {
  const NotAfterPrevious(this.previousPage);
  final int previousPage;
}

class OverTotalPages extends ValidationError {
  const OverTotalPages(this.totalPages);
  final int totalPages;
}

/// 기록 페이지가 이후 날짜 기록보다 큼 (소급 기록 시 페이지 역전 방지).
class OverNext extends ValidationError {
  const OverNext(this.nextPage);
  final int nextPage;
}

/// 책 입력값 — 폼에서 받은 그대로(검증 전).
class BookInput {
  const BookInput({
    required this.title,
    required this.totalPages,
    required this.startPage,
    required this.startDate,
    required this.dailyTarget,
    this.dueDate,
  });

  final String title;
  final int? totalPages;
  final int? startPage;
  final DateKey startDate;
  final int? dailyTarget;
  final DateKey? dueDate;
}

abstract final class BookValidator {
  /// 새 책/수정 입력 검증. [existing]이 있으면 이미 있는 기록과의 모순도 확인한다.
  /// 통과하면 null.
  static ValidationError? validate(BookInput input, {Book? existing}) {
    if (input.title.trim().isEmpty) return const TitleRequired();

    final total = input.totalPages;
    if (total == null || total < 1) return const InvalidTotalPages();

    final start = input.startPage;
    if (start == null || start < 0 || start > total) return const InvalidStartPage();

    final target = input.dailyTarget;
    if (target == null || target < 1) return const InvalidDailyTarget();

    final due = input.dueDate;
    if (due != null && due < input.startDate) return const DueBeforeStart();

    if (existing != null && existing.logs.isNotEmpty) {
      final first = existing.logs.entries.first;
      final lastPage = existing.logs.values.last;
      if (start > first.value) return StartPageAfterLogs(first.value);
      if (total < lastPage) return TotalBelowLogs(lastPage);
      if (input.startDate > first.key) return StartDateAfterLogs(first.key);
    }
    return null;
  }
}

abstract final class LogValidator {
  /// [date]에 [pageTo]까지 읽었다는 기록 검증. 통과하면 null.
  /// 날짜순으로 페이지가 계속 늘어나도록 앞뒤 기록 사이 값만 허용한다(웹 서버 규칙 이식).
  static ValidationError? validate(Book book, DateKey date, int pageTo, {required DateKey today}) {
    if (date < book.startDate || date > today) return const LogDateOutOfRange();

    final before = ReadingCalc.pageBefore(book, date);
    if (pageTo <= before) return NotAfterPrevious(before);
    if (pageTo > book.totalPages) return OverTotalPages(book.totalPages);

    final next = ReadingCalc.pageAfter(book, date);
    if (next != null && pageTo > next) return OverNext(next);
    return null;
  }
}
