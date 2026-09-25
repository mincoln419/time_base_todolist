import 'package:flutter_test/flutter_test.dart';
import 'package:readinglog/domain/date_key.dart';

void main() {
  group('DateKey', () {
    test('parse / toString 왕복', () {
      expect(DateKey.parse('2026-09-05').toString(), '2026-09-05');
    });

    test('형식이 틀리거나 없는 날짜는 거부', () {
      expect(() => DateKey.parse('2026-9-5'), throwsFormatException);
      expect(() => DateKey.parse('2026-02-30'), throwsFormatException);
      expect(DateKey.tryParse('abc'), isNull);
      expect(DateKey.tryParse(null), isNull);
    });

    test('월/연 경계 addDays', () {
      expect(DateKey.parse('2026-12-31').addDays(1), DateKey.parse('2027-01-01'));
      expect(DateKey.parse('2026-03-01').addDays(-1), DateKey.parse('2026-02-28'));
      expect(DateKey.parse('2028-02-28').addDays(1), DateKey.parse('2028-02-29'));
    });

    test('daysUntil', () {
      expect(DateKey.parse('2026-09-01').daysUntil(DateKey.parse('2026-10-01')), 30);
      expect(DateKey.parse('2026-10-01').daysUntil(DateKey.parse('2026-09-01')), -30);
    });

    test('로컬 시각의 날짜를 그대로 쓴다 (자정 직후에도 하루 밀리지 않음)', () {
      expect(DateKey.today(now: DateTime(2026, 9, 25, 0, 30)), DateKey.parse('2026-09-25'));
    });

    test('비교', () {
      final a = DateKey.parse('2026-09-24');
      final b = DateKey.parse('2026-09-25');
      expect(a < b, isTrue);
      expect(b >= a, isTrue);
      expect(a == DateKey(2026, 9, 24), isTrue);
    });
  });
}
