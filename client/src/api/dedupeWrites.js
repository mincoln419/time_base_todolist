// 저장 버튼을 연달아 눌러 같은 쓰기 요청이 두 번 나가는 것을 막는다(앱 전체 공통).
// 같은 쓰기(메서드 + URL + 본문)가 아직 진행 중이거나 막 끝났으면 다시 보내지 않고 첫 요청의 결과를 돌려준다.
// 더블클릭은 항상 같은 본문을 보내므로 걸러지고, 내용이 다른 연속 변경(체크 켜기→끄기 등)은 그대로 나간다.
// 조회(GET)와 문자열이 아닌 본문(파일 업로드 등)은 건드리지 않는다.

// 요청이 끝난 뒤에도 같은 요청을 중복으로 보는 시간 — 빠른 응답 뒤에 늦게 들어온 두 번째 클릭까지 막는 여유
const DUPLICATE_WINDOW_MS = 1000;

export function installWriteDedupe(target = globalThis) {
  const originalFetch = target.fetch.bind(target);
  const recent = new Map(); // key → { url, promise, pending, finishedAt }

  target.fetch = (input, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body;
    if (method === 'GET' || method === 'HEAD' || (body != null && typeof body !== 'string')) {
      return originalFetch(input, init);
    }

    const url = typeof input === 'string' ? input : input.url;
    const key = `${method} ${url} ${body ?? ''}`;
    const hit = recent.get(key);
    if (hit && (hit.pending || Date.now() - hit.finishedAt < DUPLICATE_WINDOW_MS)) {
      // 응답 본문은 한 번만 읽을 수 있으므로 호출한 쪽마다 복제본을 준다
      return hit.promise.then((res) => res.clone());
    }

    // 같은 대상(URL)에 다른 쓰기가 들어오면 이전 기록은 지운다 — 체크 해제 → 되돌리기 → 다시 해제처럼
    // 빠르게 오가는 정상 조작에서 세 번째 요청이 첫 번째와 같다는 이유로 걸러지지 않게 한다.
    for (const [k, e] of recent) {
      if (e.url === url) recent.delete(k);
    }

    const entry = { url, pending: true, finishedAt: 0 };
    entry.promise = originalFetch(input, init).finally(() => {
      entry.pending = false;
      entry.finishedAt = Date.now();
      setTimeout(() => {
        if (recent.get(key) === entry) recent.delete(key);
      }, DUPLICATE_WINDOW_MS);
    });
    recent.set(key, entry);
    return entry.promise.then((res) => res.clone());
  };
}
