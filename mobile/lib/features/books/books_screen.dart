import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/router.dart';
import '../../core/messages.dart';
import '../../domain/book.dart';
import '../../domain/date_key.dart';
import '../../domain/reading_calc.dart';
import '../../l10n/app_localizations.dart';

class BooksScreen extends ConsumerWidget {
  const BooksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final today = ref.watch(todayProvider);
    final snapshot = ref.watch(booksProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.booksTitle),
        actions: [
          IconButton(
            tooltip: l10n.settingsTitle,
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push(Routes.settings),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go(Routes.newBook),
        icon: const Icon(Icons.add),
        label: Text(l10n.addBook),
      ),
      body: snapshot.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text(error.toString())),
        data: (snap) {
          final remaining = snap.books.where((b) => ReadingCalc.status(b, today) != BookStatus.done).toList()
            ..sort((a, b) => _remainingOrder(a, b, today));
          final finished = snap.books.where((b) => ReadingCalc.status(b, today) == BookStatus.done).toList()
            ..sort((a, b) => b.finishedAt!.compareTo(a.finishedAt!));

          return ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            children: [
              _SectionHeader(l10n.booksRemaining(remaining.length)),
              if (remaining.isEmpty)
                Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(l10n.booksEmpty))),
              for (final book in remaining) BookCard(book: book, today: today),
              if (finished.isNotEmpty)
                ExpansionTile(
                  tilePadding: const EdgeInsets.symmetric(horizontal: 4),
                  title: Text(l10n.booksFinished(finished.length)),
                  children: [for (final book in finished) BookCard(book: book, today: today)],
                ),
            ],
          );
        },
      ),
    );
  }

  /// 읽는 중(남은 일수 적은 순) → 읽을 예정(시작일 순).
  static int _remainingOrder(Book a, Book b, DateKey today) {
    final sa = ReadingCalc.status(a, today);
    final sb = ReadingCalc.status(b, today);
    if (sa != sb) return sa == BookStatus.reading ? -1 : 1;
    if (sa == BookStatus.planned) return a.startDate.compareTo(b.startDate);
    return ReadingCalc.bookDaysLeft(a).compareTo(ReadingCalc.bookDaysLeft(b));
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
        child: Text(text, style: Theme.of(context).textTheme.titleSmall),
      );
}

class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book, required this.today});

  final Book book;
  final DateKey today;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final status = ReadingCalc.status(book, today);
    final current = ReadingCalc.currentPage(book);
    final percent = (ReadingCalc.progress(book) * 100).round();
    final eta = ReadingCalc.bookEta(book, today);
    final missed = status == BookStatus.reading ? ReadingCalc.missedDays(book, today) : 0;
    final overdue = ReadingCalc.isOverdue(book, today);
    final due = book.dueDate;
    final finishedAt = book.finishedAt;

    final details = <String>[
      l10n.bookProgress(current, book.totalPages, percent),
      if (status == BookStatus.planned) l10n.bookStartsOn(formatShortDate(book.startDate)),
      if (status == BookStatus.done && finishedAt != null)
        l10n.bookFinishedRange(
          formatShortDate(book.startDate),
          formatShortDate(finishedAt),
          book.startDate.daysUntil(finishedAt) + 1,
        ),
      if (status != BookStatus.done) ...[
        l10n.bookDailyTarget(book.dailyTarget),
        l10n.bookDaysLeft(ReadingCalc.bookDaysLeft(book)),
        if (eta != null) l10n.bookEta(formatShortDate(eta)),
      ],
      if (missed > 0) l10n.bookMissed(missed),
    ];

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.go(Routes.editBook(book.id)),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (status == BookStatus.planned) ...[
                    Chip(label: Text(l10n.statusPlanned), visualDensity: VisualDensity.compact),
                    const SizedBox(width: 8),
                  ],
                  Expanded(child: Text(book.title, style: theme.textTheme.titleMedium)),
                ],
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: ReadingCalc.progress(book).clamp(0, 1).toDouble()),
              const SizedBox(height: 8),
              Text(details.join(' · '), style: theme.textTheme.bodySmall),
              if (status != BookStatus.done && due != null)
                Text(
                  [l10n.bookDue(formatShortDate(due), formatDday(today, due)), if (overdue) l10n.overdueWarning].join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(color: overdue ? theme.colorScheme.error : null),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
