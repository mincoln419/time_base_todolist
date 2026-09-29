import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../data/book_repository.dart';
import '../data/user_settings_repository.dart';
import '../domain/date_key.dart';

final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository(ref.watch(firebaseAuthProvider)));

final authStateProvider = StreamProvider<User?>((ref) => ref.watch(authRepositoryProvider).authStateChanges());

/// 로그인한 사용자 ID. 로그인 전 화면에서는 읽지 않는다(라우터가 막음).
final uidProvider = Provider<String?>((ref) => ref.watch(authStateProvider).value?.uid);

final bookRepositoryProvider = Provider<BookRepository?>((ref) {
  final uid = ref.watch(uidProvider);
  return uid == null ? null : BookRepository(ref.watch(firestoreProvider), uid);
});

final userSettingsRepositoryProvider = Provider<UserSettingsRepository?>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return null;
  final repo = UserSettingsRepository(ref.watch(firestoreProvider), uid);
  // 첫 로그인 시 사용자 문서 생성 — 오프라인이면 다음 실행 때 다시 시도된다
  unawaited(repo.ensureCreated().catchError((Object _) {}));
  return repo;
});

final booksProvider = StreamProvider<BooksSnapshot>((ref) {
  final repo = ref.watch(bookRepositoryProvider);
  if (repo == null) return const Stream.empty();
  return repo.watchBooks();
});

final userSettingsProvider = StreamProvider<UserSettings>((ref) {
  final repo = ref.watch(userSettingsRepositoryProvider);
  if (repo == null) return Stream.value(UserSettings.initial);
  return repo.watch();
});

/// 기기 로컬 기준 "오늘". 앱이 포그라운드로 돌아올 때와 자정이 지날 때 갱신된다(Design §4.4).
final todayProvider = NotifierProvider<TodayNotifier, DateKey>(TodayNotifier.new);

class TodayNotifier extends Notifier<DateKey> with WidgetsBindingObserver {
  Timer? _midnight;

  @override
  DateKey build() {
    WidgetsBinding.instance.addObserver(this);
    ref.onDispose(() {
      WidgetsBinding.instance.removeObserver(this);
      _midnight?.cancel();
    });
    _scheduleMidnight();
    return DateKey.today();
  }

  void _scheduleMidnight() {
    _midnight?.cancel();
    final now = DateTime.now();
    final next = DateTime(now.year, now.month, now.day + 1);
    // 자정 직후 1초 여유 — 타이머가 조금 일찍 깨어나 같은 날로 계산되는 것을 막는다
    _midnight = Timer(next.difference(now) + const Duration(seconds: 1), _refresh);
  }

  void _refresh() {
    final today = DateKey.today();
    if (today != state) state = today;
    _scheduleMidnight();
  }

  @override
  // 매개변수 이름을 state로 두면 Notifier.state(오늘 날짜)를 가려 버려서 이름을 바꿨다
  // ignore: avoid_renaming_method_parameters
  void didChangeAppLifecycleState(AppLifecycleState lifecycle) {
    if (lifecycle == AppLifecycleState.resumed) _refresh();
  }
}

/// 오늘의 독서 화면에서 보고 있는 날짜. 미래로는 갈 수 없다.
/// 어제를 보던 중 자정이 지나면(= 방금까지의 오늘) 새 오늘로 따라간다.
final selectedDateProvider = NotifierProvider<SelectedDateNotifier, DateKey>(SelectedDateNotifier.new);

class SelectedDateNotifier extends Notifier<DateKey> {
  @override
  DateKey build() {
    ref.listen(todayProvider, (previous, today) {
      if (previous != null && state == previous) state = today;
    });
    return ref.read(todayProvider);
  }

  void select(DateKey date) {
    final today = ref.read(todayProvider);
    state = date > today ? today : date;
  }

  void move(int days) => select(state.addDays(days));
}
