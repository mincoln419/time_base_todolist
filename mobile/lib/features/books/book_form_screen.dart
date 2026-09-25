import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/router.dart';
import '../../core/messages.dart';
import '../../domain/book.dart';
import '../../domain/date_key.dart';
import '../../domain/reading_calc.dart';
import '../../domain/validators.dart';
import '../../l10n/app_localizations.dart';

/// 책 추가/수정 (Design §8.2). [bookId]가 있으면 수정.
class BookFormScreen extends ConsumerStatefulWidget {
  const BookFormScreen({super.key, this.bookId});

  final String? bookId;

  @override
  ConsumerState<BookFormScreen> createState() => _BookFormScreenState();
}

class _BookFormScreenState extends ConsumerState<BookFormScreen> {
  final _title = TextEditingController();
  final _startPage = TextEditingController(text: '0');
  final _totalPages = TextEditingController();
  final _dailyTarget = TextEditingController();
  late DateKey _startDate = ref.read(todayProvider);
  DateKey? _dueDate;
  bool _initialized = false;
  String? _error;

  Book? get _existing {
    final id = widget.bookId;
    if (id == null) return null;
    final books = ref.read(booksProvider).value?.books ?? const <Book>[];
    for (final b in books) {
      if (b.id == id) return b;
    }
    return null;
  }

  @override
  void dispose() {
    for (final c in [_title, _startPage, _totalPages, _dailyTarget]) {
      c.dispose();
    }
    super.dispose();
  }

  /// 수정이면 기존 값, 새 책이면 사용자 설정의 기본 하루 목표로 채운다(책 목록·설정이 로드된 뒤 한 번).
  void _initFields() {
    if (_initialized) return;
    final existing = _existing;
    if (widget.bookId != null && existing == null) return;
    if (existing != null) {
      _title.text = existing.title;
      _startPage.text = '${existing.startPage}';
      _totalPages.text = '${existing.totalPages}';
      _dailyTarget.text = '${existing.dailyTarget}';
      _startDate = existing.startDate;
      _dueDate = existing.dueDate;
    } else {
      final settings = ref.read(userSettingsProvider).value;
      if (settings == null) return;
      _dailyTarget.text = '${settings.defaultDailyTarget}';
    }
    _initialized = true;
  }

  BookInput get _input => BookInput(
        title: _title.text,
        totalPages: int.tryParse(_totalPages.text),
        startPage: int.tryParse(_startPage.text),
        startDate: _startDate,
        dailyTarget: int.tryParse(_dailyTarget.text),
        dueDate: _dueDate,
      );

  /// 수정 중인 책은 기록이 반영된 실제 현재 페이지 기준으로 계산한다.
  int? get _currentForCalc {
    final existing = _existing;
    return existing != null ? ReadingCalc.currentPage(existing) : int.tryParse(_startPage.text);
  }

  Future<DateKey?> _pickDate(DateKey initial, {DateKey? first}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(initial.year, initial.month, initial.day),
      firstDate: first == null ? DateTime(2000) : DateTime(first.year, first.month, first.day),
      lastDate: DateTime(2100),
    );
    return picked == null ? null : DateKey.fromDateTime(picked);
  }

  void _submit() {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(bookRepositoryProvider);
    if (repo == null) return;
    final existing = _existing;
    final error = BookValidator.validate(_input, existing: existing);
    if (error != null) {
      setState(() => _error = validationMessage(error, l10n));
      return;
    }
    if (existing == null) {
      reportWriteErrors(repo.addBook(_input).write, l10n);
    } else {
      reportWriteErrors(repo.updateBook(existing, _input), l10n);
    }
    context.go(Routes.books);
  }

  Future<void> _delete(Book book) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(l10n.deleteBookConfirm(book.title)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.no)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l10n.yes)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final repo = ref.read(bookRepositoryProvider);
    if (repo != null) reportWriteErrors(repo.deleteBook(book.id), l10n);
    context.go(Routes.books);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    ref.watch(booksProvider);
    ref.watch(userSettingsProvider);
    _initFields();
    final today = ref.watch(todayProvider);
    final existing = _existing;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(existing == null ? l10n.formNewTitle : l10n.formEditTitle),
        actions: [
          if (existing != null)
            IconButton(tooltip: l10n.deleteBook, icon: const Icon(Icons.delete_outline), onPressed: () => _delete(existing)),
        ],
      ),
      body: !_initialized
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _title,
                  decoration: InputDecoration(labelText: l10n.fieldTitle),
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                _DateField(
                  label: l10n.fieldStartDate,
                  value: formatFullDate(_startDate),
                  onTap: () async {
                    final picked = await _pickDate(_startDate);
                    if (picked != null) setState(() => _startDate = picked);
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _NumberField(controller: _startPage, label: l10n.fieldStartPage, onChanged: () => setState(() {}))),
                    const SizedBox(width: 12),
                    Expanded(child: _NumberField(controller: _totalPages, label: l10n.fieldTotalPages, onChanged: () => setState(() {}))),
                  ],
                ),
                const SizedBox(height: 12),
                _NumberField(controller: _dailyTarget, label: l10n.fieldDailyTarget, onChanged: () => setState(() {})),
                const SizedBox(height: 12),
                _DateField(
                  label: l10n.fieldDueDate,
                  value: _dueDate == null ? l10n.noDueDate : formatFullDate(_dueDate!),
                  onTap: () async {
                    final picked = await _pickDate(_dueDate ?? today, first: _startDate);
                    if (picked != null) setState(() => _dueDate = picked);
                  },
                  trailing: _dueDate == null
                      ? null
                      : IconButton(
                          tooltip: l10n.clearDueDate,
                          icon: const Icon(Icons.clear),
                          onPressed: () => setState(() => _dueDate = null),
                        ),
                ),
                _FitDueDateButton(
                  total: int.tryParse(_totalPages.text),
                  current: _currentForCalc,
                  startDate: _startDate,
                  dueDate: _dueDate,
                  readToday: existing != null && ReadingCalc.hasLogOn(existing, today),
                  today: today,
                  onFit: (target) => setState(() => _dailyTarget.text = '$target'),
                ),
                const SizedBox(height: 8),
                _Preview(
                  total: int.tryParse(_totalPages.text),
                  current: _currentForCalc,
                  target: int.tryParse(_dailyTarget.text),
                  startDate: _startDate,
                  readToday: existing != null && ReadingCalc.hasLogOn(existing, today),
                  today: today,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                ],
                const SizedBox(height: 24),
                FilledButton(onPressed: _submit, child: Text(l10n.saveButton)),
              ],
            ),
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({required this.controller, required this.label, required this.onChanged});

  final TextEditingController controller;
  final String label;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: label),
        onChanged: (_) => onChanged(),
      );
}

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.value, required this.onTap, this.trailing});

  final String label;
  final String value;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, suffixIcon: trailing),
          child: Text(value),
        ),
      );
}

class _FitDueDateButton extends StatelessWidget {
  const _FitDueDateButton({
    required this.total,
    required this.current,
    required this.startDate,
    required this.dueDate,
    required this.readToday,
    required this.today,
    required this.onFit,
  });

  final int? total;
  final int? current;
  final DateKey startDate;
  final DateKey? dueDate;
  final bool readToday;
  final DateKey today;
  final ValueChanged<int> onFit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final due = dueDate;
    final t = total;
    final c = current;
    if (due == null || t == null || t < 1 || c == null) return const SizedBox.shrink();

    final target = ReadingCalc.targetForDueDate(
      total: t,
      current: c,
      startDate: startDate,
      dueDate: due,
      readToday: readToday,
      today: today,
    );
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: target == null
            ? Text(l10n.dueDatePassed, style: TextStyle(color: Theme.of(context).colorScheme.error))
            : OutlinedButton(onPressed: () => onFit(target), child: Text(l10n.fitDueDate(target))),
      ),
    );
  }
}

class _Preview extends StatelessWidget {
  const _Preview({
    required this.total,
    required this.current,
    required this.target,
    required this.startDate,
    required this.readToday,
    required this.today,
  });

  final int? total;
  final int? current;
  final int? target;
  final DateKey startDate;
  final bool readToday;
  final DateKey today;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = total;
    final c = current;
    final tg = target;
    if (t == null || c == null || tg == null || t < 1 || tg < 1 || c < 0 || c > t) return const SizedBox.shrink();

    final eta = ReadingCalc.estimateFinish(
      total: t,
      current: c,
      target: tg,
      startDate: startDate,
      readToday: readToday,
      today: today,
    );
    final text = eta == null
        ? l10n.formPreviewDone
        : l10n.formPreview(tg, ReadingCalc.daysLeft(t, c, tg), formatFullDate(eta));
    return Text(text, style: TextStyle(color: Theme.of(context).colorScheme.primary));
  }
}
