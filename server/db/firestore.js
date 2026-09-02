const path = require('path');
// firebase-admin v14는 모듈형 API — require('firebase-admin')에는 앱 초기화만 있고
// firestore()/credential.cert()는 각각 서브패스에서 가져와야 한다.
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) {
  const keyPathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!keyPathEnv) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH 환경변수가 설정되지 않았습니다. (.env 참고)');
  }
  const keyPath = path.resolve(__dirname, '..', '..', keyPathEnv);
  initializeApp({
    credential: cert(require(keyPath)),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const firestore = getFirestore();

module.exports = { firestore, FieldValue };
