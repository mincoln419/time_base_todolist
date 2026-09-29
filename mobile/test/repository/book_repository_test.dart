import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:readinglog/data/book_mapper.dart';
import 'package:readinglog/data/book_repository.dart';
import 'package:readinglog/domain/book.dart';
import 'package:readinglog/domain/date_key.dart';
import 'package:readinglog/domain/validators.dart';

DateKey d(String v) => DateKey.parse(v);

void main() {
  late FakeFirebaseFirestore db;
  late BookRepository repo;

  setUp(() {
    db = FakeFirebaseFirestore();
    repo = BookRepository(db, 'alice');
  });

  Future<Book> readBook(String id) async {
    final snap = await db.doc('users/alice/books/$id').get();
    return BookMapper.fromFirestore(id, snap.data()!);
  }

  const input = BookInput(
    title: '  사피엔스 ',
    totalPages: 300,
    startPage: 120,
    startDate: DateKey(2026, 9, 20),
    dailyTarget: 10,
  );

  test('책 추가: 제목 trim, 필드가 snake_case로 저장되고 사용자 경로 아래에 생긴다', () async {
    final added = repo.addBook(input);
    await added.write;
    final raw = (await db.doc('users/alice/books/${added.id}').get()).data()!;
    expect(raw['title'], '사피엔스');
    expect(raw['total_pages'], 300);
    expect(raw['start_date'], '2026-09-20');
    expect(raw['due_date'], isNull);
    expect(raw['logs'], isEmpty);
  });

  test('기록 체크/해제는 날짜 필드만 바꾸고 완독일을 함께 갱신한다', () async {
    final added = repo.addBook(input);
    await added.write;

    var book = await readBook(added.id);
    await repo.setLog(book, d('2026-09-23'), 150);
    book = await readBook(added.id);
    await repo.setLog(book, d('2026-09-24'), 300);
    book = await readBook(added.id);
    expect(book.logs, {d('2026-09-23'): 150, d('2026-09-24'): 300});
    expect(book.finishedAt, d('2026-09-24'));

    await repo.removeLog(book, d('2026-09-24'));
    book = await readBook(added.id);
    expect(book.logs, {d('2026-09-23'): 150});
    expect(book.finishedAt, isNull);
  });

  test('책 수정은 기록을 보존하고 완독일을 다시 계산한다', () async {
    final added = repo.addBook(input);
    await added.write;
    var book = await readBook(added.id);
    await repo.setLog(book, d('2026-09-23'), 200);
    book = await readBook(added.id);

    await repo.updateBook(
      book,
      const BookInput(
        title: '사피엔스',
        totalPages: 200, // 이미 200까지 읽음 → 완독
        startPage: 120,
        startDate: DateKey(2026, 9, 20),
        dailyTarget: 20,
        dueDate: DateKey(2026, 10, 10),
      ),
    );
    book = await readBook(added.id);
    expect(book.logs, {d('2026-09-23'): 200});
    expect(book.dailyTarget, 20);
    expect(book.dueDate, d('2026-10-10'));
    expect(book.finishedAt, d('2026-09-23'));
  });

  test('watchBooks는 시작일 순으로 정렬하고 다른 사용자의 책은 보지 않는다', () async {
    await BookRepository(db, 'bob').addBook(input).write;
    await repo.addBook(const BookInput(
      title: 'B',
      totalPages: 100,
      startPage: 0,
      startDate: DateKey(2026, 9, 22),
      dailyTarget: 10,
    )).write;
    await repo.addBook(input).write;

    final snap = await repo.watchBooks().first;
    expect(snap.books.map((b) => b.title), ['사피엔스', 'B']);
  });

  test('mapper: 손상된 기록 값은 건너뛴다', () {
    final book = BookMapper.fromFirestore('x', {
      'title': 'A',
      'total_pages': 100,
      'start_page': 0,
      'start_date': '2026-09-20',
      'daily_target': 10,
      'logs': {'2026-09-21': 10, 'bad-date': 20, '2026-09-22': 'x'},
    });
    expect(book.logs, {d('2026-09-21'): 10});
  });
}
