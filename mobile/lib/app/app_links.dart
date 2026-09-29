/// 스토어 필수 링크 — 빌드 시 `--dart-define`으로 넣는다. 값이 없으면 설정 화면에서 해당 항목을 숨긴다.
///
/// ```
/// flutter build ipa \
///   --dart-define=PRIVACY_POLICY_URL=https://… \
///   --dart-define=TERMS_URL=https://… \
///   --dart-define=SUPPORT_EMAIL=…
/// ```
abstract final class AppLinks {
  static const privacyPolicyUrl = String.fromEnvironment('PRIVACY_POLICY_URL');
  static const termsUrl = String.fromEnvironment('TERMS_URL');
  static const supportEmail = String.fromEnvironment('SUPPORT_EMAIL');
}
