// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Korean (`ko`).
class AppLocalizationsKo extends AppLocalizations {
  AppLocalizationsKo([String locale = 'ko']) : super(locale);

  @override
  String get appTitle => '독서기록';

  @override
  String get navToday => '오늘';

  @override
  String get navBooks => '책';

  @override
  String get navHeatmap => '잔디';

  @override
  String get loginTitle => '하루 몇 페이지씩, 꾸준히';

  @override
  String get loginSubtitle => '여러 권을 동시에 읽어도 오늘 몇 페이지를 읽으면 되는지 알려드려요.';

  @override
  String get loginGoogle => 'Google로 계속하기';

  @override
  String get loginApple => 'Apple로 계속하기';

  @override
  String loginFailed(String error) {
    return '로그인하지 못했어요: $error';
  }

  @override
  String get todayTitle => '오늘의 독서';

  @override
  String get checkTitle => '독서 체크';

  @override
  String get todayChip => '오늘';

  @override
  String get previousDay => '이전 날';

  @override
  String get nextDay => '다음 날';

  @override
  String get pendingSync => '동기화 대기 중';

  @override
  String get emptyChecklist => '이 날짜에 읽는 중인 책이 없어요';

  @override
  String get addBook => '책 추가';

  @override
  String get checkButton => '체크';

  @override
  String get saveButton => '저장';

  @override
  String get cancelButton => '취소';

  @override
  String get finishButton => '완독';

  @override
  String get pageInputLabel => '읽은 페이지';

  @override
  String pagesReadDelta(int pages) {
    return '+$pages';
  }

  @override
  String pageRange(int from, int to) {
    return '$from → ${to}p';
  }

  @override
  String get belowTarget => '목표 미달';

  @override
  String get logRemoved => '기록을 지웠어요';

  @override
  String get undo => '되돌리기';

  @override
  String get finishDialogTitle => '완독 처리할까요?';

  @override
  String finishDialogBody(String title, String date, int total) {
    return '‘$title’의 $date 기록을 마지막 페이지(${total}p)로 저장합니다.';
  }

  @override
  String get yes => '예';

  @override
  String get no => '아니오';

  @override
  String get booksTitle => '책';

  @override
  String booksRemaining(int count) {
    return '남은 책 ($count)';
  }

  @override
  String booksFinished(int count) {
    return '완독 ($count)';
  }

  @override
  String get statusStopped => '중단';

  @override
  String booksStopped(int count) {
    return '중단 ($count)';
  }

  @override
  String get stopReading => '중단';

  @override
  String get resumeReading => '다시 읽기';

  @override
  String bookStoppedRange(String start, String end) {
    return '$start ~ $end 중단';
  }

  @override
  String get booksEmpty => '읽는 중이거나 읽을 예정인 책이 없어요';

  @override
  String get statusPlanned => '예정';

  @override
  String bookProgress(int current, int total, int percent) {
    return '$current / ${total}p ($percent%)';
  }

  @override
  String bookDailyTarget(int target) {
    return '하루 ${target}p';
  }

  @override
  String bookDaysLeft(int days) {
    return '$days일 남음';
  }

  @override
  String bookEta(String date) {
    return '예상 $date';
  }

  @override
  String bookMissed(int days) {
    return '놓친 날 $days일';
  }

  @override
  String bookDue(String date, String dday) {
    return '반납 $date ($dday)';
  }

  @override
  String get overdueWarning => '반납일 초과 예상';

  @override
  String bookStartsOn(String date) {
    return '$date 시작';
  }

  @override
  String bookFinishedRange(String start, String end, int days) {
    return '$start ~ $end ($days일)';
  }

  @override
  String get formNewTitle => '책 추가';

  @override
  String get formEditTitle => '책 수정';

  @override
  String get fieldTitle => '제목';

  @override
  String get fieldStartDate => '시작일';

  @override
  String get fieldStartPage => '현재 페이지';

  @override
  String get fieldTotalPages => '총 페이지';

  @override
  String get fieldDailyTarget => '하루 목표 (p)';

  @override
  String get fieldDueDate => '반납일 (선택)';

  @override
  String get noDueDate => '없음';

  @override
  String get clearDueDate => '반납일 지우기';

  @override
  String fitDueDate(int target) {
    return '반납일 맞추기 (${target}p)';
  }

  @override
  String get fitDueDateUnavailable => '반납일 맞추기';

  @override
  String get dueDatePassed => '반납일이 지났어요';

  @override
  String formPreview(int target, int days, String date) {
    return '하루 ${target}p 기준 약 $days일 · 예상 완독 $date';
  }

  @override
  String get formPreviewDone => '이미 완독한 상태예요';

  @override
  String get deleteBook => '삭제';

  @override
  String deleteBookConfirm(String title) {
    return '‘$title’과 모든 기록을 삭제할까요?';
  }

  @override
  String get heatmapTitle => '독서 잔디';

  @override
  String summaryTotal(int days) {
    return '총 $days일';
  }

  @override
  String summaryMonth(int days) {
    return '이번 달 $days일';
  }

  @override
  String summaryStreak(int days) {
    return '연속 $days일';
  }

  @override
  String heatmapCellLabel(String date, int pages) {
    return '$date, $pages페이지';
  }

  @override
  String get heatmapNoRecord => '기록 없음';

  @override
  String heatmapItem(String title, int pages) {
    return '$title ${pages}p';
  }

  @override
  String get recordThisDay => '이 날짜 기록하기';

  @override
  String get legendLess => '적음';

  @override
  String get legendMore => '많음';

  @override
  String dayTotal(int pages) {
    return '총 ${pages}p';
  }

  @override
  String dailyRecordsTitle(int days) {
    return '일자별 기록 ($days일)';
  }

  @override
  String showMoreDays(int days) {
    return '더 보기 ($days일 남음)';
  }

  @override
  String get noRecordsYet => '아직 기록이 없어요';

  @override
  String get settingsTitle => '설정';

  @override
  String get settingDefaultTarget => '새 책 기본 하루 목표';

  @override
  String get settingHeatmapWeeks => '잔디 표시 기간';

  @override
  String pagesValue(int pages) {
    return '${pages}p';
  }

  @override
  String weeksValue(int weeks) {
    return '$weeks주';
  }

  @override
  String get signOut => '로그아웃';

  @override
  String signedInAs(String name) {
    return '$name(으)로 로그인됨';
  }

  @override
  String get sectionReading => '독서';

  @override
  String get sectionAccount => '계정';

  @override
  String get sectionAbout => '정보';

  @override
  String get deleteAccount => '계정 삭제';

  @override
  String get deleteAccountConfirmTitle => '계정을 삭제할까요?';

  @override
  String get deleteAccountConfirmBody =>
      '모든 책과 독서 기록이 삭제되고 되돌릴 수 없어요. 본인 확인을 위해 한 번 더 로그인해요.';

  @override
  String get deletingAccount => '계정을 삭제하는 중…';

  @override
  String deleteAccountFailed(String error) {
    return '계정을 삭제하지 못했어요. 다시 시도해 주세요: $error';
  }

  @override
  String get privacyPolicy => '개인정보처리방침';

  @override
  String get terms => '이용약관';

  @override
  String get contactSupport => '문의하기';

  @override
  String appVersion(String version, String build) {
    return '버전 $version ($build)';
  }

  @override
  String get errTitleRequired => '제목을 입력해 주세요';

  @override
  String get errInvalidTotal => '총 페이지는 1 이상으로 입력해 주세요';

  @override
  String get errInvalidStart => '현재 페이지는 0 ~ 총 페이지 사이로 입력해 주세요';

  @override
  String get errInvalidTarget => '하루 목표는 1 이상으로 입력해 주세요';

  @override
  String get errDueBeforeStart => '반납일은 시작일 이후여야 해요';

  @override
  String errStartPageAfterLogs(int page) {
    return '이미 기록된 페이지(${page}p)보다 클 수 없어요';
  }

  @override
  String errTotalBelowLogs(int page) {
    return '이미 읽은 페이지(${page}p)보다 작을 수 없어요';
  }

  @override
  String errStartDateAfterLogs(String date) {
    return '$date 기록이 있어 그 이후로 바꿀 수 없어요';
  }

  @override
  String get errLogDate => '시작일부터 오늘까지만 기록할 수 있어요';

  @override
  String errNotAfterPrevious(int page) {
    return '이전 기록(${page}p)보다 커야 해요';
  }

  @override
  String errOverTotal(int total) {
    return '총 페이지(${total}p)를 넘을 수 없어요';
  }

  @override
  String errOverNext(int page) {
    return '이후 기록(${page}p)보다 클 수 없어요';
  }

  @override
  String get errStoppedBook => '중단한 책은 중단일 이후로 기록할 수 없어요. 다시 읽기로 바꿔 주세요';

  @override
  String errSaveFailed(String error) {
    return '저장하지 못했어요: $error';
  }
}
