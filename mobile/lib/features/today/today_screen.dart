import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/router.dart';
import '../../core/messages.dart';
import '../../domain/date_key.dart';
import '../../domain/reading_calc.dart';
import '../../l10n/app_localizations.dart';
import 'checklist_tile.dart';

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final today = ref.watch(todayProvider);
    final date = ref.watch(selectedDateProvider);
    final snapshot = ref.watch(booksProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(date == today ? l10n.todayTitle : l10n.checkTitle),
        actions: [
          IconButton(
            tooltip: l10n.settingsTitle,
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push(Routes.settings),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: _DateBar(date: date, today: today),
        ),
      ),
      body: snapshot.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text(error.toString())),
        data: (snap) {
          final books = snap.books.where((b) => ReadingCalc.isOnChecklist(b, date)).toList();
          return Column(
            children: [
              if (snap.hasPendingWrites)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Chip(avatar: const Icon(Icons.sync, size: 16), label: Text(l10n.pendingSync)),
                ),
              Expanded(
                child: books.isEmpty
                    ? _EmptyChecklist(onAdd: () => context.go(Routes.newBook))
                    : ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: books.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) => ChecklistTile(
                          key: ValueKey('${books[i].id}_$date'),
                          book: books[i],
                          date: date,
                          today: today,
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DateBar extends ConsumerWidget {
  const _DateBar({required this.date, required this.today});

  final DateKey date;
  final DateKey today;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final selected = ref.read(selectedDateProvider.notifier);

    Future<void> pick() async {
      final picked = await showDatePicker(
        context: context,
        initialDate: DateTime(date.year, date.month, date.day),
        firstDate: DateTime(2000),
        lastDate: DateTime(today.year, today.month, today.day),
      );
      if (picked != null) selected.select(DateKey.fromDateTime(picked));
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(tooltip: l10n.previousDay, icon: const Icon(Icons.chevron_left), onPressed: () => selected.move(-1)),
        TextButton(onPressed: pick, child: Text(formatDayHeader(date))),
        IconButton(
          tooltip: l10n.nextDay,
          icon: const Icon(Icons.chevron_right),
          onPressed: date < today ? () => selected.move(1) : null,
        ),
        if (date != today)
          ActionChip(label: Text(l10n.todayChip), onPressed: () => selected.select(today)),
      ],
    );
  }
}

class _EmptyChecklist extends StatelessWidget {
  const _EmptyChecklist({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.emptyChecklist),
          const SizedBox(height: 12),
          FilledButton.tonalIcon(onPressed: onAdd, icon: const Icon(Icons.add), label: Text(l10n.addBook)),
        ],
      ),
    );
  }
}
