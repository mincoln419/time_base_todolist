import 'dart:collection';

import 'date_key.dart';

/// 책 한 권과 그 책의 날짜별 기록.
///
/// 기록(`logs`)은 "그날 도달한 페이지"만 담고, 현재 페이지·그날 읽은 양·예상일 같은 값은
/// 모두 [ReadingCalc]에서 계산한다. Firestore에서는 책 문서 안의 map 필드로 저장되어
/// 체크 한 번이 문서 1건 쓰기로 끝난다(오프라인 쓰기 가능 — Design §3.2).
class Book {
  Book({
    required this.id,
    required this.title,
    required this.totalPages,
    required this.startPage,
    required this.startDate,
    required this.dailyTarget,
    this.dueDate,
    this.finishedAt,
    Map<DateKey, int> logs = const {},
  }) : logs = UnmodifiableMapView(SplayTreeMap<DateKey, int>.of(logs));

  final String id;
  final String title;
  final int totalPages;

  /// 등록 시점에 이미 읽은 페이지.
  final int startPage;
  final DateKey startDate;

  /// 책마다 사용자가 정하는 하루 목표 페이지.
  final int dailyTarget;

  /// 반납일(선택) — 도서관 책처럼 기한이 있을 때만.
  final DateKey? dueDate;

  /// 총 페이지에 처음 도달한 기록의 날짜. 기록이 바뀔 때마다 [ReadingCalc.computeFinishedAt]으로 다시 계산.
  final DateKey? finishedAt;

  /// 날짜 오름차순으로 정렬된 기록 (날짜 → 그날 도달한 페이지).
  final Map<DateKey, int> logs;

  Book copyWith({
    String? title,
    int? totalPages,
    int? startPage,
    DateKey? startDate,
    int? dailyTarget,
    DateKey? Function()? dueDate,
    DateKey? Function()? finishedAt,
    Map<DateKey, int>? logs,
  }) {
    return Book(
      id: id,
      title: title ?? this.title,
      totalPages: totalPages ?? this.totalPages,
      startPage: startPage ?? this.startPage,
      startDate: startDate ?? this.startDate,
      dailyTarget: dailyTarget ?? this.dailyTarget,
      dueDate: dueDate != null ? dueDate() : this.dueDate,
      finishedAt: finishedAt != null ? finishedAt() : this.finishedAt,
      logs: logs ?? this.logs,
    );
  }
}
