import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/router.dart';
import '../../core/messages.dart';
import '../../domain/date_key.dart';
import '../../domain/reading_calc.dart';
import '../../l10n/app_localizations.dart';

/// 그날 전체 페이지 합 → 색 단계 경계 (웹 ReadingHeatmap과 같은 초기값, Design §8.3).
/// 도메인 규칙이 아닌 시각화 구간이라 한 곳에 모아 둔다.
const _levelThresholds = [1, 10, 20, 40];
const _cellSize = 14.0;
const _cellGap = 3.0;

class HeatmapScreen extends ConsumerWidget {
  const HeatmapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final today = ref.watch(todayProvider);
    final weeks = ref.watch(userSettingsProvider).value?.heatmapWeeks;
    final snapshot = ref.watch(booksProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.heatmapTitle),
        actions: [
          IconButton(
            tooltip: l10n.settingsTitle,
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push(Routes.settings),
          ),
        ],
      ),
      body: snapshot.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text(error.toString())),
        data: (snap) {
          if (weeks == null) return const Center(child: CircularProgressIndicator());
          final totals = ReadingCalc.dailyTotals(snap.books);
          final monthDays = totals.keys.where((d) => d.year == today.year && d.month == today.month).length;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Chip(label: Text(l10n.summaryTotal(totals.length))),
                  Chip(label: Text(l10n.summaryMonth(monthDays))),
                  Chip(label: Text(l10n.summaryStreak(ReadingCalc.streak(totals, today)))),
                ],
              ),
              const SizedBox(height: 16),
              _HeatmapGrid(totals: totals, today: today, weeks: weeks),
              const SizedBox(height: 12),
              const _Legend(),
            ],
          );
        },
      ),
    );
  }
}

Color _levelColor(ColorScheme scheme, int pages) {
  var level = 0;
  for (final threshold in _levelThresholds) {
    if (pages >= threshold) level += 1;
  }
  if (level == 0) return scheme.surfaceContainerHighest;
  return scheme.primary.withValues(alpha: 0.25 + 0.75 * (level / _levelThresholds.length));
}

class _HeatmapGrid extends StatelessWidget {
  const _HeatmapGrid({required this.totals, required this.today, required this.weeks});

  final Map<DateKey, DailyTotal> totals;
  final DateKey today;
  final int weeks;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // 이번 주 토요일에서 끝나는 [weeks]주, 일요일 시작 열 (DateKey.weekday: 월=1 … 일=7)
    final saturday = today.addDays(6 - today.weekday % 7);
    final start = saturday.addDays(-(weeks * 7 - 1));

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      reverse: true, // 최신 주가 먼저 보이도록
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var w = 0; w < weeks; w++)
            Padding(
              padding: const EdgeInsets.only(right: _cellGap),
              child: Column(
                children: [
                  SizedBox(
                    height: 16,
                    width: _cellSize,
                    child: _MonthLabel(week: [for (var d = 0; d < 7; d++) start.addDays(w * 7 + d)]),
                  ),
                  for (var d = 0; d < 7; d++) _cell(context, scheme, start.addDays(w * 7 + d)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _cell(BuildContext context, ColorScheme scheme, DateKey date) {
    if (date > today) return const SizedBox(width: _cellSize, height: _cellSize + _cellGap);
    final l10n = AppLocalizations.of(context);
    final pages = totals[date]?.pages ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: _cellGap),
      child: Semantics(
        button: true,
        label: l10n.heatmapCellLabel(formatFullDate(date), pages),
        child: GestureDetector(
          onTap: () => _showDay(context, date),
          child: Container(
            width: _cellSize,
            height: _cellSize,
            decoration: BoxDecoration(
              color: _levelColor(scheme, pages),
              borderRadius: BorderRadius.circular(3),
              border: date == today ? Border.all(color: scheme.outline) : null,
            ),
          ),
        ),
      ),
    );
  }

  void _showDay(BuildContext context, DateKey date) {
    final l10n = AppLocalizations.of(context);
    final total = totals[date];
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => Consumer(
        builder: (context, ref, _) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(formatDayHeader(date), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (total == null) Text(l10n.heatmapNoRecord),
                for (final item in total?.items ?? const <DailyItem>[])
                  Text(
                    [l10n.heatmapItem(item.title, item.pages), if (item.belowTarget) l10n.belowTarget].join(' · '),
                  ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () {
                    ref.read(selectedDateProvider.notifier).select(date);
                    Navigator.pop(sheetContext);
                    context.go(Routes.today);
                  },
                  child: Text(l10n.recordThisDay),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 1일이 포함된 주 열 위에만 월 표시.
class _MonthLabel extends StatelessWidget {
  const _MonthLabel({required this.week});

  final List<DateKey> week;

  @override
  Widget build(BuildContext context) {
    DateKey? first;
    for (final d in week) {
      if (d.day == 1) first = d;
    }
    if (first == null) return const SizedBox.shrink();
    return OverflowBox(
      maxWidth: 40,
      alignment: Alignment.centerLeft,
      child: Text('${first.month}월', style: Theme.of(context).textTheme.labelSmall),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final samples = [0, ..._levelThresholds];
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(l10n.legendLess, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(width: 4),
        for (final pages in samples)
          Container(
            width: _cellSize,
            height: _cellSize,
            margin: const EdgeInsets.symmetric(horizontal: 1.5),
            decoration: BoxDecoration(color: _levelColor(scheme, pages), borderRadius: BorderRadius.circular(3)),
          ),
        const SizedBox(width: 4),
        Text(l10n.legendMore, style: Theme.of(context).textTheme.labelSmall),
      ],
    );
  }
}
