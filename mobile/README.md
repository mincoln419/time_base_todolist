# readinglog (독서기록 모바일 앱)

하루 목표 페이지로 여러 권을 읽는 독서 습관 앱. 패키지/번들 ID `com.codenyang.readinglog`.

- Plan: `../docs/01-plan/features/reading-log-mobile.plan.md`
- Design: `../docs/02-design/features/reading-log-mobile.design.md`

## 처음 세팅

Firebase 설정 파일(`lib/firebase_options.dart`, `android/app/google-services.json`,
`ios/Runner/GoogleService-Info.plist`)은 저장소에 올리지 않는다. 새로 클론했으면 생성한다.

```bash
# 필요 도구: Flutter, Firebase CLI(`firebase login`), FlutterFire CLI
dart pub global activate flutterfire_cli
gem install xcodeproj        # flutterfire가 iOS 프로젝트를 수정할 때 필요 (Homebrew Ruby 기준)

cd mobile
flutterfire configure --project=readinglog-efa02 --platforms=android,ios
flutter pub get
```

## 테스트

```bash
cd mobile
flutter analyze
flutter test                         # domain 단위 테스트 포함

cd firebase/rules-test               # Firestore 보안 규칙 (에뮬레이터, Java 필요)
npm install
npm test
```

## 보안 규칙 배포

```bash
cd mobile
firebase deploy --only firestore:rules,firestore:indexes --project readinglog-efa02
```

`mobile/firebase.json`은 flutterfire 설정과 Firestore 규칙 설정을 함께 담는다.
루트의 `firebase.json`/`firestore.rules`는 웹 앱용이므로 섞지 않는다.
