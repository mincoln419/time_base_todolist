import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../domain/date_key.dart';
import '../domain/validators.dart';
import '../l10n/app_localizations.dart';

/// 화면 어디서든 스낵바를 띄우기 위한 전역 키 (MaterialApp에 연결).
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

void showMessage(String message, {SnackBarAction? action}) {
  scaffoldMessengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), action: action));
}

/// 쓰기 Future의 실패를 스낵바로 알린다. 오프라인이면 완료가 늦어질 뿐 실패가 아니므로 기다리지 않는다.
void reportWriteErrors(Future<void> write, AppLocalizations l10n) {
  write.catchError((Object error) => showMessage(l10n.errSaveFailed(error.toString())));
}

String validationMessage(ValidationError error, AppLocalizations l10n) => switch (error) {
      TitleRequired() => l10n.errTitleRequired,
      InvalidTotalPages() => l10n.errInvalidTotal,
      InvalidStartPage() => l10n.errInvalidStart,
      InvalidDailyTarget() => l10n.errInvalidTarget,
      DueBeforeStart() => l10n.errDueBeforeStart,
      StartPageAfterLogs(:final firstLoggedPage) => l10n.errStartPageAfterLogs(firstLoggedPage),
      TotalBelowLogs(:final lastLoggedPage) => l10n.errTotalBelowLogs(lastLoggedPage),
      StartDateAfterLogs(:final firstLoggedDate) => l10n.errStartDateAfterLogs(formatShortDate(firstLoggedDate)),
      LogDateOutOfRange() => l10n.errLogDate,
      StoppedBook() => l10n.errStoppedBook,
      NotAfterPrevious(:final previousPage) => l10n.errNotAfterPrevious(previousPage),
      OverTotalPages(:final totalPages) => l10n.errOverTotal(totalPages),
      OverNext(:final nextPage) => l10n.errOverNext(nextPage),
    };

DateTime _toDateTime(DateKey d) => DateTime(d.year, d.month, d.day);

/// "9월 25일 (목)"
String formatDayHeader(DateKey d) => DateFormat('M월 d일 (E)', 'ko').format(_toDateTime(d));

/// "9/25"
String formatShortDate(DateKey d) => '${d.month}/${d.day}';

/// "2026. 9. 25."
String formatFullDate(DateKey d) => DateFormat.yMMMd('ko').format(_toDateTime(d));

/// 반납일까지 남은 날 — "D-3", 당일 "D-DAY", 지나면 "D+2"
String formatDday(DateKey today, DateKey target) {
  final diff = today.daysUntil(target);
  if (diff == 0) return 'D-DAY';
  return diff > 0 ? 'D-$diff' : 'D+${-diff}';
}
