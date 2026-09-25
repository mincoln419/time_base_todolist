import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../app/providers.dart';
import '../../core/messages.dart';
import '../../l10n/app_localizations.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _busy = false;

  Future<void> _signIn(Future<Object?> Function() action) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await action();
      // 성공하면 라우터 redirect가 오늘 화면으로 보낸다
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled) showMessage(l10n.loginFailed(e.description ?? e.code.name));
    } catch (e) {
      showMessage(l10n.loginFailed(e.toString()));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.read(authRepositoryProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Icon(Icons.menu_book, size: 64, color: theme.colorScheme.primary),
              const SizedBox(height: 24),
              Text(l10n.loginTitle, style: theme.textTheme.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Text(l10n.loginSubtitle, style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
              const Spacer(),
              FilledButton.icon(
                onPressed: _busy ? null : () => _signIn(auth.signInWithApple),
                icon: const Icon(Icons.apple),
                label: Text(l10n.loginApple),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _signIn(auth.signInWithGoogle),
                icon: const Icon(Icons.account_circle_outlined),
                label: Text(l10n.loginGoogle),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
