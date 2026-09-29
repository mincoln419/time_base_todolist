import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:readinglog/data/account_deletion.dart';

void main() {
  test('사용자 데이터 삭제: 본인 책 전부와 사용자 문서만 지우고 다른 사용자는 건드리지 않는다', () async {
    final db = FakeFirebaseFirestore();
    await db.doc('users/alice').set({'default_daily_target': 10, 'heatmap_weeks': 26});
    for (var i = 0; i < 3; i++) {
      await db.collection('users/alice/books').add({'title': 'A$i'});
    }
    await db.doc('users/bob').set({'default_daily_target': 10, 'heatmap_weeks': 26});
    await db.collection('users/bob/books').add({'title': 'B'});

    await AccountDeletion.deleteUserData(db, 'alice');

    expect((await db.doc('users/alice').get()).exists, isFalse);
    expect((await db.collection('users/alice/books').get()).docs, isEmpty);
    expect((await db.doc('users/bob').get()).exists, isTrue);
    expect((await db.collection('users/bob/books').get()).docs, hasLength(1));
  });

  test('이미 지워진 상태에서 다시 실행해도 실패하지 않는다 (재시도 가능)', () async {
    final db = FakeFirebaseFirestore();
    await AccountDeletion.deleteUserData(db, 'alice');
    await AccountDeletion.deleteUserData(db, 'alice');
  });
}
