import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/books/book_form_screen.dart';
import '../features/books/books_screen.dart';
import '../features/heatmap/heatmap_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/today/today_screen.dart';
import '../l10n/app_localizations.dart';
import 'providers.dart';

abstract final class Routes {
  static const login = '/login';
  static const today = '/today';
  static const books = '/books';
  static const newBook = '/books/new';
  static String editBook(String id) => '/books/$id/edit';
  static const heatmap = '/heatmap';
  static const settings = '/settings';
}

/// 로그인 상태가 바뀌면 라우터가 redirect를 다시 평가하도록 알린다.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Stream<Object?> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<Object?> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh(ref.watch(authRepositoryProvider).authStateChanges());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.today,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authStateProvider);
      if (auth.isLoading && !auth.hasValue) return null;
      final signedIn = auth.value != null;
      final onLogin = state.matchedLocation == Routes.login;
      if (!signedIn) return onLogin ? null : Routes.login;
      if (onLogin) return Routes.today;
      return null;
    },
    routes: [
      GoRoute(path: Routes.login, builder: (context, state) => const LoginScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.today, builder: (context, state) => const TodayScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.books,
              builder: (context, state) => const BooksScreen(),
              routes: [
                GoRoute(path: 'new', builder: (context, state) => const BookFormScreen()),
                GoRoute(
                  path: ':id/edit',
                  builder: (context, state) => BookFormScreen(bookId: state.pathParameters['id']),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.heatmap, builder: (context, state) => const HeatmapScreen()),
          ]),
        ],
      ),
      GoRoute(path: Routes.settings, builder: (context, state) => const SettingsScreen()),
    ],
  );
});

class _HomeShell extends StatelessWidget {
  const _HomeShell({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (index) => shell.goBranch(index, initialLocation: index == shell.currentIndex),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.check_circle_outline), selectedIcon: const Icon(Icons.check_circle), label: l10n.navToday),
          NavigationDestination(icon: const Icon(Icons.menu_book_outlined), selectedIcon: const Icon(Icons.menu_book), label: l10n.navBooks),
          NavigationDestination(icon: const Icon(Icons.grid_view_outlined), selectedIcon: const Icon(Icons.grid_view), label: l10n.navHeatmap),
        ],
      ),
    );
  }
}
