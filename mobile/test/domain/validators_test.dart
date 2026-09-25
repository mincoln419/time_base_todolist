import 'package:flutter_test/flutter_test.dart';
import 'package:readinglog/domain/book.dart';
import 'package:readinglog/domain/date_key.dart';
import 'package:readinglog/domain/validators.dart';

DateKey d(String v) => DateKey.parse(v);

void main() {
  final today = d('2026-09-24');
  final b = Book(
    id: 'b1',
    title: 'A',
    totalPages: 300,
    startPage: 120,
    startDate: d('2026-09-20'),
    dailyTarget: 10,
    logs: {d('2026-09-22'): 125, d('2026-09-24'): 150},
  );

  group('LogValidator', () {
    ValidationError? check(String date, int page) => LogValidator.validate(b, d(date), page, today: today);

    test('정상: 앞뒤 기록 사이', () {
      expect(check('2026-09-23', 140), isNull);
      expect(check('2026-09-24', 160), isNull); // 오늘 기록 수정
    });

    test('날짜 범위: 시작일 이전·미래 거부', () {
      expect(check('2026-09-19', 130), isA<LogDateOutOfRange>());
      expect(check('2026-09-25', 160), isA<LogDateOutOfRange>());
    });

    test('이전 기록 이하 거부 (시작 페이지 포함)', () {
      expect((check('2026-09-21', 120) as NotAfterPrevious).previousPage, 120);
      expect((check('2026-09-23', 125) as NotAfterPrevious).previousPage, 125);
    });

    test('총 페이지 초과 거부', () {
      expect(check('2026-09-24', 301), isA<OverTotalPages>());
    });

    test('4. 소급 기록이 이후 기록보다 크면 거부', () {
      expect((check('2026-09-23', 151) as OverNext).nextPage, 150);
    });
  });

  group('BookValidator', () {
    BookInput input({
      String title = 'A',
      int? total = 300,
      int? start = 0,
      String startDate = '2026-09-20',
      int? target = 10,
      String? due,
    }) =>
        BookInput(
          title: title,
          totalPages: total,
          startPage: start,
          startDate: d(startDate),
          dailyTarget: target,
          dueDate: due == null ? null : d(due),
        );

    test('정상', () => expect(BookValidator.validate(input()), isNull));

    test('필드별 거부', () {
      expect(BookValidator.validate(input(title: '  ')), isA<TitleRequired>());
      expect(BookValidator.validate(input(total: 0)), isA<InvalidTotalPages>());
      expect(BookValidator.validate(input(total: null)), isA<InvalidTotalPages>());
      expect(BookValidator.validate(input(start: 301)), isA<InvalidStartPage>());
      expect(BookValidator.validate(input(start: -1)), isA<InvalidStartPage>());
      expect(BookValidator.validate(input(target: 0)), isA<InvalidDailyTarget>());
      expect(BookValidator.validate(input(due: '2026-09-19')), isA<DueBeforeStart>());
    });

    test('수정 시 기존 기록과 모순되면 거부', () {
      expect(BookValidator.validate(input(start: 126), existing: b), isA<StartPageAfterLogs>());
      expect(BookValidator.validate(input(total: 149), existing: b), isA<TotalBelowLogs>());
      expect(BookValidator.validate(input(startDate: '2026-09-23'), existing: b), isA<StartDateAfterLogs>());
      expect(BookValidator.validate(input(start: 120), existing: b), isNull);
    });
  });
}
