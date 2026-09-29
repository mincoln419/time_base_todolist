import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/app_links.dart';
import '../../app/providers.dart';
import '../../core/messages.dart';
import '../../data/account_deletion.dart';
import '../../l10n/app_localizations.dart';

final _packageInfoProvider = FutureProvider<PackageInfo>((ref) => PackageInfo.fromPlatform());

/// 설정 (Design §8.2): 독서(기본 하루 목표·잔디 기간), 계정(로그아웃·삭제), 정보(약관·문의·버전).
/// 리마인더는 별도 항목으로 추가된다.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _deleting = false;

  Future<int?> _askNumber(String title, int initial) {
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

  Future<void> _deleteAccount() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.deleteAccountConfirmTitle),
        content: Text(l10n.deleteAccountConfirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.no)),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.deleteAccount),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      await AccountDeletion(ref.read(authRepositoryProvider), ref.read(firestoreProvider)).run();
      // 성공하면 로그인 상태가 사라져 라우터가 로그인 화면으로 보낸다
    } catch (e) {
      showMessage(l10n.deleteAccountFailed(e.toString()));
      if (mounted) setState(() => _deleting = false);
    }
  }

  Future<void> _open(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      showMessage(uri.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final settings = ref.watch(userSettingsProvider).value;
    final repo = ref.watch(userSettingsRepositoryProvider);
    final user = ref.watch(authStateProvider).value;
    final info = ref.watch(_packageInfoProvider).value;
    final theme = Theme.of(context);

    if (_deleting) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [const CircularProgressIndicator(), const SizedBox(height: 16), Text(l10n.deletingAccount)],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: settings == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                _Header(l10n.sectionReading),
                ListTile(
                  title: Text(l10n.settingDefaultTarget),
                  trailing: Text(l10n.pagesValue(settings.defaultDailyTarget)),
                  onTap: () async {
                    final value = await _askNumber(l10n.settingDefaultTarget, settings.defaultDailyTarget);
                    if (value != null && repo != null) {
                      reportWriteErrors(repo.save(settings.copyWith(defaultDailyTarget: value)), l10n);
                    }
                  },
                ),
                ListTile(
                  title: Text(l10n.settingHeatmapWeeks),
                  trailing: Text(l10n.weeksValue(settings.heatmapWeeks)),
                  onTap: () async {
                    final value = await _askNumber(l10n.settingHeatmapWeeks, settings.heatmapWeeks);
                    if (value != null && repo != null) {
                      reportWriteErrors(repo.save(settings.copyWith(heatmapWeeks: value)), l10n);
                    }
                  },
                ),
                const Divider(),
                _Header(l10n.sectionAccount),
                if (user != null) ListTile(title: Text(l10n.signedInAs(user.email ?? user.displayName ?? user.uid))),
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: Text(l10n.signOut),
                  onTap: () => ref.read(authRepositoryProvider).signOut(),
                ),
                ListTile(
                  leading: Icon(Icons.delete_forever_outlined, color: theme.colorScheme.error),
                  title: Text(l10n.deleteAccount, style: TextStyle(color: theme.colorScheme.error)),
                  onTap: _deleteAccount,
                ),
                const Divider(),
                _Header(l10n.sectionAbout),
                if (AppLinks.privacyPolicyUrl.isNotEmpty)
                  ListTile(
                    title: Text(l10n.privacyPolicy),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () => _open(Uri.parse(AppLinks.privacyPolicyUrl)),
                  ),
                if (AppLinks.termsUrl.isNotEmpty)
                  ListTile(
                    title: Text(l10n.terms),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () => _open(Uri.parse(AppLinks.termsUrl)),
                  ),
                if (AppLinks.supportEmail.isNotEmpty)
                  ListTile(
                    title: Text(l10n.contactSupport),
                    subtitle: const Text(AppLinks.supportEmail),
                    onTap: () => _open(Uri(scheme: 'mailto', path: AppLinks.supportEmail)),
                  ),
                if (info != null) ListTile(title: Text(l10n.appVersion(info.version, info.buildNumber))),
              ],
            ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Theme.of(context).colorScheme.primary)),
      );
}
