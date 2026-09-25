import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/messages.dart';
import '../../domain/book.dart';
import '../../domain/date_key.dart';
import '../../domain/reading_calc.dart';
import '../../domain/validators.dart';
import '../../l10n/app_localizations.dart';

/// 오늘의 독서 체크리스트 한 줄 — 체크 / 체크 해제 / 도달 페이지 수정 / 완독 (Design §8.2).
class ChecklistTile extends ConsumerStatefulWidget {
  const ChecklistTile({super.key, required this.book, required this.date, required this.today});

  final Book book;
  final DateKey date;
  final DateKey today;

  @override
  ConsumerState<ChecklistTile> createState() => _ChecklistTileState();
}

class _ChecklistTileState extends ConsumerState<ChecklistTile> {
  late final TextEditingController _page = TextEditingController(text: '${_defaultPage()}');
  bool _editing = false;
  String? _error;

  Book get _book => widget.book;
  int? get _logged => _book.logs[widget.date];
  int get _before => ReadingCalc.pageBefore(_book, widget.date);

  int _defaultPage() {
    final logged = _logged;
    if (logged != null) return logged;
    final next = _before + _book.dailyTarget;
    return next > _book.totalPages ? _book.totalPages : next;
  }

  @override
  void didUpdateWidget(ChecklistTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.book.logs[widget.date] != _logged && !_editing) _page.text = '${_defaultPage()}';
  }

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  bool _save(int? pageTo) {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(bookRepositoryProvider);
    if (repo == null) return false;
    if (pageTo == null) {
      setState(() => _error = l10n.errNotAfterPrevious(_before));
      return false;
    }
    final error = LogValidator.validate(_book, widget.date, pageTo, today: widget.today);
    if (error != null) {
      setState(() => _error = validationMessage(error, l10n));
      return false;
    }
    setState(() {
      _error = null;
      _editing = false;
    });
    reportWriteErrors(repo.setLog(_book, widget.date, pageTo), l10n);
    return true;
  }

  void _uncheck() {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(bookRepositoryProvider);
    final previous = _logged;
    if (repo == null || previous == null) return;
    reportWriteErrors(repo.removeLog(_book, widget.date), l10n);
    showMessage(
      l10n.logRemoved,
      action: SnackBarAction(
        label: l10n.undo,
        onPressed: () => reportWriteErrors(repo.setLog(_book, widget.date, previous), l10n),
      ),
    );
  }

  Future<void> _confirmFinish() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.finishDialogTitle),
        content: Text(l10n.finishDialogBody(_book.title, formatFullDate(widget.date), _book.totalPages)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.no)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l10n.yes)),
        ],
      ),
    );
    if (ok == true && mounted) _save(_book.totalPages);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final logged = _logged;
    final checked = logged != null;
    final read = checked ? logged - _before : 0;
    final showInput = !checked || _editing;

    return Card(
      color: checked ? theme.colorScheme.primaryContainer.withValues(alpha: 0.4) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Checkbox(
                  value: checked,
                  onChanged: (value) => value == true ? _save(int.tryParse(_page.text)) : _uncheck(),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_book.title, style: theme.textTheme.titleMedium),
                      Text(
                        '${ReadingCalc.currentPage(_book)} / ${_book.totalPages}p',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (checked && !_editing)
                  TextButton(
                    onPressed: () => setState(() => _editing = true),
                    child: Text('${l10n.pageRange(_before, logged)}  ${l10n.pagesReadDelta(read)}'),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(left: 44),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (showInput) ...[
                    Text('$_before →'),
                    SizedBox(
                      width: 88,
                      child: TextField(
                        controller: _page,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: InputDecoration(isDense: true, labelText: l10n.pageInputLabel),
                        onSubmitted: (v) => _save(int.tryParse(v)),
                      ),
                    ),
                    FilledButton(
                      onPressed: () => _save(int.tryParse(_page.text)),
                      child: Text(checked ? l10n.saveButton : l10n.checkButton),
                    ),
                    if (_editing)
                      TextButton(
                        onPressed: () => setState(() {
                          _editing = false;
                          _error = null;
                          _page.text = '${_defaultPage()}';
                        }),
                        child: Text(l10n.cancelButton),
                      ),
                  ],
                  if (checked && read < _book.dailyTarget)
                    Chip(label: Text(l10n.belowTarget), visualDensity: VisualDensity.compact),
                  if (logged == null || logged < _book.totalPages)
                    OutlinedButton(onPressed: _confirmFinish, child: Text(l10n.finishButton)),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(left: 44, top: 4),
                child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
              ),
          ],
        ),
      ),
    );
  }
}
