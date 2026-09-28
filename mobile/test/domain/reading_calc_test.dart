import 'package:flutter_test/flutter_test.dart';
import 'package:readinglog/domain/book.dart';
import 'package:readinglog/domain/date_key.dart';
import 'package:readinglog/domain/reading_calc.dart';

DateKey d(String v) => DateKey.parse(v);

Book book({
  String id = 'b1',
  String title = 'A',
  int total = 300,
  int start = 120,
  String startDate = '2026-09-24',
  int target = 10,
  String? due,
  Map<String, int> logs = const {},
}) {
  final b = Book(
    id: id,
    title: title,
    totalPages: total,
    startPage: start,
    startDate: d(startDate),
    dailyTarget: target,
    dueDate: due == null ? null : d(due),
    logs: {for (final e in logs.entries) d(e.key): e.value},
  );
  return b.copyWith(finishedAt: () => ReadingCalc.computeFinishedAt(b));
}

void main() {
  final today = d('2026-09-24');

  // 웹 Design §8 / 모바일 Design §11.1 시나리오 이식
  group('Design §11.1 시나리오', () {
    test('1. 300p / 현재 120p / 목표 10 → 18일, 예상 = 오늘+17', () {
      final b = book();
      expect(ReadingCalc.bookDaysLeft(b), 18);
      expect(ReadingCalc.bookEta(b, today), today.addDays(17));
    });

    test('2. 오늘 150p 체크 → 15일, 예상 = 내일+14', () {
      final b = ReadingCalc.withLog(book(), today, 150);
      expect(ReadingCalc.bookDaysLeft(b), 15);
      expect(ReadingCalc.bookEta(b, today), today.addDays(15));
      expect(ReadingCalc.pagesOn(b, today), 30);
    });

    test('3. 소급: 어제 125, 오늘 130 → 어제 +5, 오늘 +5', () {
      final b = book(startDate: '2026-09-20', logs: {'2026-09-23': 125, '2026-09-24': 130});
      expect(ReadingCalc.pagesOn(b, d('2026-09-23')), 5);
      expect(ReadingCalc.pagesOn(b, today), 5);
      expect(ReadingCalc.pageBefore(b, today), 125);
      expect(ReadingCalc.pageAfter(b, d('2026-09-23')), 130);
    });

    test('5. 총 페이지 도달 → finishedAt = 그 날짜, 해제하면 다시 null', () {
      final done = ReadingCalc.withLog(book(), today, 300);
      expect(done.finishedAt, today);
      expect(ReadingCalc.status(done, today), BookStatus.done);
      expect(ReadingCalc.bookEta(done, today), isNull);

      final undone = ReadingCalc.withoutLog(done, today);
      expect(undone.finishedAt, isNull);
      expect(ReadingCalc.status(undone, today), BookStatus.reading);
    });

    test('6. 시작일이 미래 → planned, 예상은 시작일 기준', () {
      final b = book(start: 0, startDate: '2026-10-01');
      expect(ReadingCalc.status(b, today), BookStatus.planned);
      expect(ReadingCalc.bookEta(b, today), d('2026-10-30')); // 30일째
    });

    test('7. 반납일 맞추기: 420p, 오늘~10/14(21일) → 20p, 오늘 읽었으면 내일부터', () {
      int? target(Map<String, Object> o) => ReadingCalc.targetForDueDate(
            total: o['total'] as int,
            current: o['current'] as int,
            startDate: d(o['start'] as String),
            dueDate: d(o['due'] as String),
            readToday: o['readToday'] as bool,
            today: today,
          );
      expect(target({'total': 420, 'current': 0, 'start': '2026-09-24', 'due': '2026-10-14', 'readToday': false}), 20);
      expect(target({'total': 100, 'current': 0, 'start': '2026-09-24', 'due': '2026-10-14', 'readToday': false}), 5);
      expect(target({'total': 420, 'current': 100, 'start': '2026-09-14', 'due': '2026-10-04', 'readToday': false}), 30);
      expect(target({'total': 420, 'current': 100, 'start': '2026-09-14', 'due': '2026-10-04', 'readToday': true}), 32);
      expect(target({'total': 300, 'current': 0, 'start': '2026-10-01', 'due': '2026-10-10', 'readToday': false}), 30);
    });

    test('8. 반납일 지남 → null', () {
      expect(
        ReadingCalc.targetForDueDate(
          total: 420,
          current: 100,
          startDate: d('2026-09-01'),
          dueDate: d('2026-09-20'),
          readToday: false,
          today: today,
        ),
        isNull,
      );
    });

    test('10. 놓친 날: 시작 9/20, 기록 9/23·9/24, 오늘 9/24 → 3', () {
      final b = book(startDate: '2026-09-20', logs: {'2026-09-23': 125, '2026-09-24': 130});
      expect(ReadingCalc.missedDays(b, today), 3);
    });
  });

  group('기타 계산', () {
    test('daysLeft 올림, 남은 페이지 없으면 0', () {
      expect(ReadingCalc.daysLeft(100, 95, 10), 1);
      expect(ReadingCalc.daysLeft(100, 100, 10), 0);
    });

    test('등록 시점에 이미 끝난 책은 시작일이 완독일', () {
      expect(book(start: 300).finishedAt, d('2026-09-24'));
    });

    test('isOverdue: 예상일이 반납일을 넘으면 true', () {
      expect(ReadingCalc.isOverdue(book(due: '2026-10-01'), today), isTrue); // 예상 10/11
      expect(ReadingCalc.isOverdue(book(due: '2026-10-20'), today), isFalse);
      expect(ReadingCalc.isOverdue(book(), today), isFalse);
    });

    test('dailyTotals: 여러 책 합계와 책별 목표 미달', () {
      final a = book(id: 'a', title: 'A', start: 0, startDate: '2026-09-20', logs: {'2026-09-23': 12, '2026-09-24': 20});
      final b = book(id: 'b', title: 'B', start: 50, startDate: '2026-09-20', target: 20, logs: {'2026-09-24': 60});
      final totals = ReadingCalc.dailyTotals([a, b]);
      expect(totals[d('2026-09-23')]!.pages, 12);
      expect(totals[d('2026-09-24')]!.pages, 18); // A +8, B +10
      final items = totals[d('2026-09-24')]!.items;
      expect(items.map((i) => i.belowTarget), [true, true]); // A 8<10, B 10<20
    });

    test('streak: 오늘 기록 없으면 어제부터', () {
      final b = book(start: 0, startDate: '2026-09-20', logs: {'2026-09-22': 10, '2026-09-23': 20});
      final totals = ReadingCalc.dailyTotals([b]);
      expect(ReadingCalc.streak(totals, today), 2);
      expect(ReadingCalc.streak(totals, d('2026-09-26')), 0);
    });

    test('isOnChecklist: 시작 전·완독 이후 제외', () {
      final done = ReadingCalc.withLog(book(startDate: '2026-09-20'), d('2026-09-22'), 300);
      expect(ReadingCalc.isOnChecklist(done, d('2026-09-19')), isFalse);
      expect(ReadingCalc.isOnChecklist(done, d('2026-09-22')), isTrue);
      expect(ReadingCalc.isOnChecklist(done, d('2026-09-23')), isFalse);
    });
  });
}
