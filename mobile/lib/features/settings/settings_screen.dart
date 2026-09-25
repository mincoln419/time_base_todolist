import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/messages.dart';
import '../../l10n/app_localizations.dart';

/// 설정 (M2 범위: 기본 하루 목표, 잔디 기간, 로그아웃). 리마인더·계정 삭제·약관은 M3에서 추가.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  Future<int?> _askNumber(BuildContext context, String title, int initial) {
    final controller = TextEditingController(text: '$initial');
    final l10n = AppLocalizations.of(context);
    return showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancelButton)),
          FilledButton(
            onPressed: () {
              final value = int.tryParse(controller.text);
              if (value != null && value >= 1) Navigator.pop(context, value);
            },
            child: Text(l10n.saveButton),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(userSettingsProvider).value;
    final repo = ref.watch(userSettingsRepositoryProvider);
    final user = ref.watch(authStateProvider).value;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: settings == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                ListTile(
                  title: Text(l10n.settingDefaultTarget),
                  trailing: Text(l10n.pagesValue(settings.defaultDailyTarget)),
                  onTap: () async {
                    final value = await _askNumber(context, l10n.settingDefaultTarget, settings.defaultDailyTarget);
                    if (value != null && repo != null) {
                      reportWriteErrors(repo.save(settings.copyWith(defaultDailyTarget: value)), l10n);
                    }
                  },
                ),
                ListTile(
                  title: Text(l10n.settingHeatmapWeeks),
                  trailing: Text(l10n.weeksValue(settings.heatmapWeeks)),
                  onTap: () async {
                    final value = await _askNumber(context, l10n.settingHeatmapWeeks, settings.heatmapWeeks);
                    if (value != null && repo != null) {
                      reportWriteErrors(repo.save(settings.copyWith(heatmapWeeks: value)), l10n);
                    }
                  },
                ),
                const Divider(),
                if (user != null)
                  ListTile(
                    title: Text(l10n.signedInAs(user.email ?? user.displayName ?? user.uid)),
                  ),
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: Text(l10n.signOut),
                  onTap: () => ref.read(authRepositoryProvider).signOut(),
                ),
              ],
            ),
    );
  }
}
