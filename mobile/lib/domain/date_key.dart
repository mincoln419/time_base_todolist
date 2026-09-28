/// 기기 로컬 기준 날짜(연·월·일)만 담는 값 객체. Firestore에는 `YYYY-MM-DD` 문자열로 저장한다.
///
/// 날짜 계산은 UTC 달력 위에서 하되 값 자체는 "로컬 날짜"로 취급한다 — 로컬 `DateTime`으로
/// 더하고 빼면 서머타임 전환일에 하루가 23/25시간이 되어 일수가 어긋나기 때문이다.
/// `toUtc()`나 ISO 문자열 자르기로 날짜를 만들면 한국 시간 자정~오전 9시에 하루가 밀리므로 금지.
class DateKey implements Comparable<DateKey> {
  const DateKey(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  static final RegExp _pattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  /// `YYYY-MM-DD` 문자열을 파싱한다. 형식이 틀리거나 존재하지 않는 날짜(2월 30일 등)면 [FormatException].
  factory DateKey.parse(String value) {
    final match = _pattern.firstMatch(value);
    if (match == null) throw FormatException('YYYY-MM-DD 형식이 아닙니다', value);
    final key = DateKey(
      int.parse(match.group(1)!),
      int.parse(match.group(2)!),
      int.parse(match.group(3)!),
    );
    if (key._normalized() != key) throw FormatException('존재하지 않는 날짜입니다', value);
    return key;
  }

  static DateKey? tryParse(String? value) {
    if (value == null) return null;
    try {
      return DateKey.parse(value);
    } on FormatException {
      return null;
    }
  }

  /// 로컬 시각의 날짜 부분. 테스트에서는 [now]를 넘겨 고정한다.
  factory DateKey.fromDateTime(DateTime local) => DateKey(local.year, local.month, local.day);

  factory DateKey.today({DateTime? now}) => DateKey.fromDateTime(now ?? DateTime.now());

  DateTime get _utc => DateTime.utc(year, month, day);

  DateKey _normalized() => DateKey(_utc.year, _utc.month, _utc.day);

  DateKey addDays(int days) {
    final d = DateTime.utc(year, month, day + days);
    return DateKey(d.year, d.month, d.day);
  }

  /// [other]까지의 일수. 같은 날이면 0, [other]가 이전 날이면 음수.
  int daysUntil(DateKey other) => other._utc.difference(_utc).inDays;

  /// 요일 (월=1 … 일=7, [DateTime.weekday]와 같음).
  int get weekday => _utc.weekday;

  bool isBefore(DateKey other) => compareTo(other) < 0;
  bool isAfter(DateKey other) => compareTo(other) > 0;
  bool operator <(DateKey other) => compareTo(other) < 0;
  bool operator <=(DateKey other) => compareTo(other) <= 0;
  bool operator >(DateKey other) => compareTo(other) > 0;
  bool operator >=(DateKey other) => compareTo(other) >= 0;

  @override
  int compareTo(DateKey other) {
    if (year != other.year) return year.compareTo(other.year);
    if (month != other.month) return month.compareTo(other.month);
    return day.compareTo(other.day);
  }

  @override
  bool operator ==(Object other) =>
      other is DateKey && other.year == year && other.month == month && other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
}
