import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFocusMap, createFocusMap, saveFocusMap } from '../api/focusMap';

const EMPTY_STATE = { goal: '', items: [], step: 0, cursor: 0, addedTaskIds: [] };

// Design Ref: §2.2 — activeId가 없으면(새 목표 초안) 로컬 상태만 유지하고 서버에 저장하지 않는다.
// "영향력부터 매기기" 시점에 commit()으로 최초 저장한다 (Plan §7.2 저장 시점 결정).
export function useFocusMap(activeId, { onSaved } = {}) {
  const [state, setState] = useState(EMPTY_STATE);
  const [loaded, setLoaded] = useState(activeId == null);
  const [error, setError] = useState('');
  // 서버에서 막 불러왔거나 방금 commit()으로 저장한 state는 곧바로 다시 PUT하지 않는다
  const skipSaveRef = useRef(false);

  useEffect(() => {
    if (activeId == null) {
      setState(EMPTY_STATE);
      setLoaded(true);
      setError('');
      return;
    }
    setLoaded(false);
    skipSaveRef.current = true;
    fetchFocusMap(activeId)
      .then((s) => { setState(s); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [activeId]);

  // Design Ref: §2.2 — 목록은 저장 성공 시점에 재조회 (좌측 목록의 진행 단계 배지를 최신 상태로 유지)
  // 저장은 별도 effect에서 담당한다: setState updater 안에서 네트워크 부수효과를 실행하면
  // StrictMode의 이중 호출 시 동일한 PUT이 두 번 나가므로 updater는 순수하게 유지한다.
  useEffect(() => {
    if (activeId == null) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    saveFocusMap(activeId, state).then(() => onSaved?.()).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const update = useCallback((updater) => {
    setState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const commit = useCallback(async (nextState) => {
    const created = await createFocusMap(nextState);
    skipSaveRef.current = true;
    setState(created);
    return created;
  }, []);

  return { state, loaded, error, update, commit };
}
