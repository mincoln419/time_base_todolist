// Firestore 보안 규칙 테스트 (Design §11.2) — `npm test`로 에뮬레이터를 띄워 실행한다.
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';

let env;

const validBook = {
  title: '사피엔스',
  total_pages: 636,
  start_page: 40,
  start_date: '2026-09-24',
  daily_target: 10,
  due_date: null,
  logs: { '2026-09-24': 52 },
  finished_at: null,
};

const validUser = { default_daily_target: 10, heatmap_weeks: 26 };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-readinglog',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8085,
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const guest = () => env.unauthenticatedContext().firestore();
const aliceBook = (db) => doc(db, 'users/alice/books/b1');

async function seedAliceBook(data = validBook) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice/books/b1'), data);
  });
}

describe('소유자 분리', () => {
  test('본인 책은 생성·조회·수정·삭제 가능', async () => {
    await assertSucceeds(setDoc(aliceBook(alice()), validBook));
    await assertSucceeds(getDoc(aliceBook(alice())));
    await assertSucceeds(updateDoc(aliceBook(alice()), { 'logs.2026-09-25': 62 }));
    await assertSucceeds(updateDoc(aliceBook(alice()), { 'logs.2026-09-25': deleteField() }));
    await assertSucceeds(deleteDoc(aliceBook(alice())));
  });

  test('다른 사용자는 읽기·쓰기·삭제 불가', async () => {
    await seedAliceBook();
    await assertFails(getDoc(aliceBook(bob())));
    await assertFails(setDoc(aliceBook(bob()), validBook));
    await assertFails(deleteDoc(aliceBook(bob())));
  });

  test('비로그인은 접근 불가', async () => {
    await seedAliceBook();
    await assertFails(getDoc(aliceBook(guest())));
    await assertFails(setDoc(aliceBook(guest()), validBook));
  });

  test('사용자 문서도 본인만', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), validUser));
    await assertFails(getDoc(doc(bob(), 'users/alice')));
    await assertFails(setDoc(doc(bob(), 'users/alice'), validUser));
  });
});

describe('책 형식·범위 검증', () => {
  const invalid = {
    '빈 제목': { title: '' },
    '제목 한도 초과': { title: 'x'.repeat(501) },
    '총 페이지 0': { total_pages: 0 },
    '총 페이지 실수': { total_pages: 10.5 },
    '시작 페이지 음수': { start_page: -1 },
    '시작 페이지 > 총': { start_page: 700 },
    '하루 목표 0': { daily_target: 0 },
    '시작일 형식': { start_date: '2026/09/24' },
    '반납일 < 시작일': { due_date: '2026-09-23' },
    '완독일 형식': { finished_at: 'yesterday' },
    'logs가 map 아님': { logs: [52] },
    '허용하지 않은 필드': { owner: 'bob' },
  };

  for (const [name, patch] of Object.entries(invalid)) {
    test(`거부: ${name}`, async () => {
      await assertFails(setDoc(aliceBook(alice()), { ...validBook, ...patch }));
    });
  }

  test('필수 필드 누락 거부', async () => {
    const { logs, ...withoutLogs } = validBook;
    await assertFails(setDoc(aliceBook(alice()), withoutLogs));
  });

  test('선택 필드(due_date/finished_at) 생략·유효값 허용', async () => {
    const { due_date, finished_at, ...minimal } = validBook;
    await assertSucceeds(setDoc(aliceBook(alice()), minimal));
    await assertSucceeds(setDoc(aliceBook(alice()), { ...validBook, due_date: '2026-10-14', finished_at: '2026-10-01' }));
  });

  test('기존 문서의 정상 부분 수정 허용', async () => {
    await seedAliceBook();
    await assertSucceeds(updateDoc(aliceBook(alice()), { daily_target: 20, due_date: '2026-10-14' }));
    await assertSucceeds(updateDoc(aliceBook(alice()), { 'logs.2026-09-25': 62, finished_at: null }));
  });

  test('수정 결과가 규칙을 어기면 거부 (부분 업데이트도 전체 문서로 검사)', async () => {
    await seedAliceBook();
    await assertFails(updateDoc(aliceBook(alice()), { total_pages: 30 })); // start_page 40 > 30
  });
});

describe('사용자 문서 검증', () => {
  test('설정 값 범위', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...validUser, default_daily_target: 0 }));
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...validUser, heatmap_weeks: 0 }));
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...validUser, extra: true }));
  });
});
