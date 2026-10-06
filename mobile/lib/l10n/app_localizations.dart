import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ko.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('ko')];

  /// No description provided for @appTitle.
  ///
  /// In ko, this message translates to:
  /// **'독서기록'**
  String get appTitle;

  /// No description provided for @navToday.
  ///
  /// In ko, this message translates to:
  /// **'오늘'**
  String get navToday;

  /// No description provided for @navBooks.
  ///
  /// In ko, this message translates to:
  /// **'책'**
  String get navBooks;

  /// No description provided for @navHeatmap.
  ///
  /// In ko, this message translates to:
  /// **'잔디'**
  String get navHeatmap;

  /// No description provided for @loginTitle.
  ///
  /// In ko, this message translates to:
  /// **'하루 몇 페이지씩, 꾸준히'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In ko, this message translates to:
  /// **'여러 권을 동시에 읽어도 오늘 몇 페이지를 읽으면 되는지 알려드려요.'**
  String get loginSubtitle;

  /// No description provided for @loginGoogle.
  ///
  /// In ko, this message translates to:
  /// **'Google로 계속하기'**
  String get loginGoogle;

  /// No description provided for @loginApple.
  ///
  /// In ko, this message translates to:
  /// **'Apple로 계속하기'**
  String get loginApple;

  /// No description provided for @loginFailed.
  ///
  /// In ko, this message translates to:
  /// **'로그인하지 못했어요: {error}'**
  String loginFailed(String error);

  /// No description provided for @todayTitle.
  ///
  /// In ko, this message translates to:
  /// **'오늘의 독서'**
  String get todayTitle;

  /// No description provided for @checkTitle.
  ///
  /// In ko, this message translates to:
  /// **'독서 체크'**
  String get checkTitle;

  /// No description provided for @todayChip.
  ///
  /// In ko, this message translates to:
  /// **'오늘'**
  String get todayChip;

  /// No description provided for @previousDay.
  ///
  /// In ko, this message translates to:
  /// **'이전 날'**
  String get previousDay;

  /// No description provided for @nextDay.
  ///
  /// In ko, this message translates to:
  /// **'다음 날'**
  String get nextDay;

  /// No description provided for @pendingSync.
  ///
  /// In ko, this message translates to:
  /// **'동기화 대기 중'**
  String get pendingSync;

  /// No description provided for @emptyChecklist.
  ///
  /// In ko, this message translates to:
  /// **'이 날짜에 읽는 중인 책이 없어요'**
  String get emptyChecklist;

  /// No description provided for @addBook.
  ///
  /// In ko, this message translates to:
  /// **'책 추가'**
  String get addBook;

  /// No description provided for @checkButton.
  ///
  /// In ko, this message translates to:
  /// **'체크'**
  String get checkButton;

  /// No description provided for @saveButton.
  ///
  /// In ko, this message translates to:
  /// **'저장'**
  String get saveButton;

  /// No description provided for @cancelButton.
  ///
  /// In ko, this message translates to:
  /// **'취소'**
  String get cancelButton;

  /// No description provided for @finishButton.
  ///
  /// In ko, this message translates to:
  /// **'완독'**
  String get finishButton;

  /// No description provided for @pageInputLabel.
  ///
  /// In ko, this message translates to:
  /// **'읽은 페이지'**
  String get pageInputLabel;

  /// No description provided for @pagesReadDelta.
  ///
  /// In ko, this message translates to:
  /// **'+{pages}'**
  String pagesReadDelta(int pages);

  /// No description provided for @pageRange.
  ///
  /// In ko, this message translates to:
  /// **'{from} → {to}p'**
  String pageRange(int from, int to);

  /// No description provided for @belowTarget.
  ///
  /// In ko, this message translates to:
  /// **'목표 미달'**
  String get belowTarget;

  /// No description provided for @logRemoved.
  ///
  /// In ko, this message translates to:
  /// **'기록을 지웠어요'**
  String get logRemoved;

  /// No description provided for @undo.
  ///
  /// In ko, this message translates to:
  /// **'되돌리기'**
  String get undo;

  /// No description provided for @finishDialogTitle.
  ///
  /// In ko, this message translates to:
  /// **'완독 처리할까요?'**
  String get finishDialogTitle;

  /// No description provided for @finishDialogBody.
  ///
  /// In ko, this message translates to:
  /// **'‘{title}’의 {date} 기록을 마지막 페이지({total}p)로 저장합니다.'**
  String finishDialogBody(String title, String date, int total);

  /// No description provided for @yes.
  ///
  /// In ko, this message translates to:
  /// **'예'**
  String get yes;

  /// No description provided for @no.
  ///
  /// In ko, this message translates to:
  /// **'아니오'**
  String get no;

  /// No description provided for @booksTitle.
  ///
  /// In ko, this message translates to:
  /// **'책'**
  String get booksTitle;

  /// No description provided for @booksRemaining.
  ///
  /// In ko, this message translates to:
  /// **'남은 책 ({count})'**
  String booksRemaining(int count);

  /// No description provided for @booksFinished.
  ///
  /// In ko, this message translates to:
  /// **'완독 ({count})'**
  String booksFinished(int count);

  /// No description provided for @statusStopped.
  ///
  /// In ko, this message translates to:
  /// **'중단'**
  String get statusStopped;

  /// No description provided for @booksStopped.
  ///
  /// In ko, this message translates to:
  /// **'중단 ({count})'**
  String booksStopped(int count);

  /// No description provided for @stopReading.
  ///
  /// In ko, this message translates to:
  /// **'중단'**
  String get stopReading;

  /// No description provided for @resumeReading.
  ///
  /// In ko, this message translates to:
  /// **'다시 읽기'**
  String get resumeReading;

  /// No description provided for @bookStoppedRange.
  ///
  /// In ko, this message translates to:
  /// **'{start} ~ {end} 중단'**
  String bookStoppedRange(String start, String end);

  /// No description provided for @booksEmpty.
  ///
  /// In ko, this message translates to:
  /// **'읽는 중이거나 읽을 예정인 책이 없어요'**
  String get booksEmpty;

  /// No description provided for @statusPlanned.
  ///
  /// In ko, this message translates to:
  /// **'예정'**
  String get statusPlanned;

  /// No description provided for @bookProgress.
  ///
  /// In ko, this message translates to:
  /// **'{current} / {total}p ({percent}%)'**
  String bookProgress(int current, int total, int percent);

  /// No description provided for @bookDailyTarget.
  ///
  /// In ko, this message translates to:
  /// **'하루 {target}p'**
  String bookDailyTarget(int target);

  /// No description provided for @bookDaysLeft.
  ///
  /// In ko, this message translates to:
  /// **'{days}일 남음'**
  String bookDaysLeft(int days);

  /// No description provided for @bookEta.
  ///
  /// In ko, this message translates to:
  /// **'예상 {date}'**
  String bookEta(String date);

  /// No description provided for @bookMissed.
  ///
  /// In ko, this message translates to:
  /// **'놓친 날 {days}일'**
  String bookMissed(int days);

  /// No description provided for @bookDue.
  ///
  /// In ko, this message translates to:
  /// **'반납 {date} ({dday})'**
  String bookDue(String date, String dday);

  /// No description provided for @overdueWarning.
  ///
  /// In ko, this message translates to:
  /// **'반납일 초과 예상'**
  String get overdueWarning;

  /// No description provided for @bookStartsOn.
  ///
  /// In ko, this message translates to:
  /// **'{date} 시작'**
  String bookStartsOn(String date);

  /// No description provided for @bookFinishedRange.
  ///
  /// In ko, this message translates to:
  /// **'{start} ~ {end} ({days}일)'**
  String bookFinishedRange(String start, String end, int days);

  /// No description provided for @formNewTitle.
  ///
  /// In ko, this message translates to:
  /// **'책 추가'**
  String get formNewTitle;

  /// No description provided for @formEditTitle.
  ///
  /// In ko, this message translates to:
  /// **'책 수정'**
  String get formEditTitle;

  /// No description provided for @fieldTitle.
  ///
  /// In ko, this message translates to:
  /// **'제목'**
  String get fieldTitle;

  /// No description provided for @fieldStartDate.
  ///
  /// In ko, this message translates to:
  /// **'시작일'**
  String get fieldStartDate;

  /// No description provided for @fieldStartPage.
  ///
  /// In ko, this message translates to:
  /// **'현재 페이지'**
  String get fieldStartPage;

  /// No description provided for @fieldTotalPages.
  ///
  /// In ko, this message translates to:
  /// **'총 페이지'**
  String get fieldTotalPages;

  /// No description provided for @fieldDailyTarget.
  ///
  /// In ko, this message translates to:
  /// **'하루 목표 (p)'**
  String get fieldDailyTarget;

  /// No description provided for @fieldDueDate.
  ///
  /// In ko, this message translates to:
  /// **'반납일 (선택)'**
  String get fieldDueDate;

  /// No description provided for @noDueDate.
  ///
  /// In ko, this message translates to:
  /// **'없음'**
  String get noDueDate;

  /// No description provided for @clearDueDate.
  ///
  /// In ko, this message translates to:
  /// **'반납일 지우기'**
  String get clearDueDate;

  /// No description provided for @fitDueDate.
  ///
  /// In ko, this message translates to:
  /// **'반납일 맞추기 ({target}p)'**
  String fitDueDate(int target);

  /// No description provided for @fitDueDateUnavailable.
  ///
  /// In ko, this message translates to:
  /// **'반납일 맞추기'**
  String get fitDueDateUnavailable;

  /// No description provided for @dueDatePassed.
  ///
  /// In ko, this message translates to:
  /// **'반납일이 지났어요'**
  String get dueDatePassed;

  /// No description provided for @formPreview.
  ///
  /// In ko, this message translates to:
  /// **'하루 {target}p 기준 약 {days}일 · 예상 완독 {date}'**
  String formPreview(int target, int days, String date);

  /// No description provided for @formPreviewDone.
  ///
  /// In ko, this message translates to:
  /// **'이미 완독한 상태예요'**
  String get formPreviewDone;

  /// No description provided for @deleteBook.
  ///
  /// In ko, this message translates to:
  /// **'삭제'**
  String get deleteBook;

  /// No description provided for @deleteBookConfirm.
  ///
  /// In ko, this message translates to:
  /// **'‘{title}’과 모든 기록을 삭제할까요?'**
  String deleteBookConfirm(String title);

  /// No description provided for @heatmapTitle.
  ///
  /// In ko, this message translates to:
  /// **'독서 잔디'**
  String get heatmapTitle;

  /// No description provided for @summaryTotal.
  ///
  /// In ko, this message translates to:
  /// **'총 {days}일'**
  String summaryTotal(int days);

  /// No description provided for @summaryMonth.
  ///
  /// In ko, this message translates to:
  /// **'이번 달 {days}일'**
  String summaryMonth(int days);

  /// No description provided for @summaryStreak.
  ///
  /// In ko, this message translates to:
  /// **'연속 {days}일'**
  String summaryStreak(int days);

  /// No description provided for @heatmapCellLabel.
  ///
  /// In ko, this message translates to:
  /// **'{date}, {read}페이지 읽음, 목표 {target}페이지'**
  String heatmapCellLabel(String date, int read, int target);

  /// No description provided for @achievementLine.
  ///
  /// In ko, this message translates to:
  /// **'{read}p / 목표 {target}p ({percent}%)'**
  String achievementLine(int read, int target, int percent);

  /// No description provided for @noPlanThatDay.
  ///
  /// In ko, this message translates to:
  /// **'이날은 읽을 계획이 없었어요'**
  String get noPlanThatDay;

  /// No description provided for @heatmapNoRecord.
  ///
  /// In ko, this message translates to:
  /// **'기록 없음'**
  String get heatmapNoRecord;

  /// No description provided for @heatmapItem.
  ///
  /// In ko, this message translates to:
  /// **'{title} {pages}p'**
  String heatmapItem(String title, int pages);

  /// No description provided for @recordThisDay.
  ///
  /// In ko, this message translates to:
  /// **'이 날짜 기록하기'**
  String get recordThisDay;

  /// No description provided for @legendLess.
  ///
  /// In ko, this message translates to:
  /// **'계획 대비'**
  String get legendLess;

  /// No description provided for @legendMore.
  ///
  /// In ko, this message translates to:
  /// **'150%+'**
  String get legendMore;

  /// No description provided for @dayTotal.
  ///
  /// In ko, this message translates to:
  /// **'총 {pages}p'**
  String dayTotal(int pages);

  /// No description provided for @dailyRecordsTitle.
  ///
  /// In ko, this message translates to:
  /// **'일자별 기록 ({days}일)'**
  String dailyRecordsTitle(int days);

  /// No description provided for @showMoreDays.
  ///
  /// In ko, this message translates to:
  /// **'더 보기 ({days}일 남음)'**
  String showMoreDays(int days);

  /// No description provided for @noRecordsYet.
  ///
  /// In ko, this message translates to:
  /// **'아직 기록이 없어요'**
  String get noRecordsYet;

  /// No description provided for @settingsTitle.
  ///
  /// In ko, this message translates to:
  /// **'설정'**
  String get settingsTitle;

  /// No description provided for @settingDefaultTarget.
  ///
  /// In ko, this message translates to:
  /// **'새 책 기본 하루 목표'**
  String get settingDefaultTarget;

  /// No description provided for @settingHeatmapWeeks.
  ///
  /// In ko, this message translates to:
  /// **'잔디 표시 기간'**
  String get settingHeatmapWeeks;

  /// No description provided for @pagesValue.
  ///
  /// In ko, this message translates to:
  /// **'{pages}p'**
  String pagesValue(int pages);

  /// No description provided for @weeksValue.
  ///
  /// In ko, this message translates to:
  /// **'{weeks}주'**
  String weeksValue(int weeks);

  /// No description provided for @signOut.
  ///
  /// In ko, this message translates to:
  /// **'로그아웃'**
  String get signOut;

  /// No description provided for @signedInAs.
  ///
  /// In ko, this message translates to:
  /// **'{name}(으)로 로그인됨'**
  String signedInAs(String name);

  /// No description provided for @sectionReading.
  ///
  /// In ko, this message translates to:
  /// **'독서'**
  String get sectionReading;

  /// No description provided for @sectionAccount.
  ///
  /// In ko, this message translates to:
  /// **'계정'**
  String get sectionAccount;

  /// No description provided for @sectionAbout.
  ///
  /// In ko, this message translates to:
  /// **'정보'**
  String get sectionAbout;

  /// No description provided for @deleteAccount.
  ///
  /// In ko, this message translates to:
  /// **'계정 삭제'**
  String get deleteAccount;

  /// No description provided for @deleteAccountConfirmTitle.
  ///
  /// In ko, this message translates to:
  /// **'계정을 삭제할까요?'**
  String get deleteAccountConfirmTitle;

  /// No description provided for @deleteAccountConfirmBody.
  ///
  /// In ko, this message translates to:
  /// **'모든 책과 독서 기록이 삭제되고 되돌릴 수 없어요. 본인 확인을 위해 한 번 더 로그인해요.'**
  String get deleteAccountConfirmBody;

  /// No description provided for @deletingAccount.
  ///
  /// In ko, this message translates to:
  /// **'계정을 삭제하는 중…'**
  String get deletingAccount;

  /// No description provided for @deleteAccountFailed.
  ///
  /// In ko, this message translates to:
  /// **'계정을 삭제하지 못했어요. 다시 시도해 주세요: {error}'**
  String deleteAccountFailed(String error);

  /// No description provided for @privacyPolicy.
  ///
  /// In ko, this message translates to:
  /// **'개인정보처리방침'**
  String get privacyPolicy;

  /// No description provided for @terms.
  ///
  /// In ko, this message translates to:
  /// **'이용약관'**
  String get terms;

  /// No description provided for @contactSupport.
  ///
  /// In ko, this message translates to:
  /// **'문의하기'**
  String get contactSupport;

  /// No description provided for @appVersion.
  ///
  /// In ko, this message translates to:
  /// **'버전 {version} ({build})'**
  String appVersion(String version, String build);

  /// No description provided for @errTitleRequired.
  ///
  /// In ko, this message translates to:
  /// **'제목을 입력해 주세요'**
  String get errTitleRequired;

  /// No description provided for @errInvalidTotal.
  ///
  /// In ko, this message translates to:
  /// **'총 페이지는 1 이상으로 입력해 주세요'**
  String get errInvalidTotal;

  /// No description provided for @errInvalidStart.
  ///
  /// In ko, this message translates to:
  /// **'현재 페이지는 0 ~ 총 페이지 사이로 입력해 주세요'**
  String get errInvalidStart;

  /// No description provided for @errInvalidTarget.
  ///
  /// In ko, this message translates to:
  /// **'하루 목표는 1 이상으로 입력해 주세요'**
  String get errInvalidTarget;

  /// No description provided for @errDueBeforeStart.
  ///
  /// In ko, this message translates to:
  /// **'반납일은 시작일 이후여야 해요'**
  String get errDueBeforeStart;

  /// No description provided for @errStartPageAfterLogs.
  ///
  /// In ko, this message translates to:
  /// **'이미 기록된 페이지({page}p)보다 클 수 없어요'**
  String errStartPageAfterLogs(int page);

  /// No description provided for @errTotalBelowLogs.
  ///
  /// In ko, this message translates to:
  /// **'이미 읽은 페이지({page}p)보다 작을 수 없어요'**
  String errTotalBelowLogs(int page);

  /// No description provided for @errStartDateAfterLogs.
  ///
  /// In ko, this message translates to:
  /// **'{date} 기록이 있어 그 이후로 바꿀 수 없어요'**
  String errStartDateAfterLogs(String date);

  /// No description provided for @errLogDate.
  ///
  /// In ko, this message translates to:
  /// **'시작일부터 오늘까지만 기록할 수 있어요'**
  String get errLogDate;

  /// No description provided for @errNotAfterPrevious.
  ///
  /// In ko, this message translates to:
  /// **'이전 기록({page}p)보다 커야 해요'**
  String errNotAfterPrevious(int page);

  /// No description provided for @errOverTotal.
  ///
  /// In ko, this message translates to:
  /// **'총 페이지({total}p)를 넘을 수 없어요'**
  String errOverTotal(int total);

  /// No description provided for @errOverNext.
  ///
  /// In ko, this message translates to:
  /// **'이후 기록({page}p)보다 클 수 없어요'**
  String errOverNext(int page);

  /// No description provided for @errStoppedBook.
  ///
  /// In ko, this message translates to:
  /// **'중단한 책은 중단일 이후로 기록할 수 없어요. 다시 읽기로 바꿔 주세요'**
  String get errStoppedBook;

  /// No description provided for @errSaveFailed.
  ///
  /// In ko, this message translates to:
  /// **'저장하지 못했어요: {error}'**
  String errSaveFailed(String error);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ko'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ko':
      return AppLocalizationsKo();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
