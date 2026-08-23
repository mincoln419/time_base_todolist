import { useState, useEffect } from 'react';
import { useFocusMapList } from '../../hooks/useFocusMapList';
import { useFocusMap } from '../../hooks/useFocusMap';
import FocusMapList from './FocusMapList';

const IMPACT = [
  { v: 1, l: '거의 없음' }, { v: 2, l: '약간' }, { v: 3, l: '보통' }, { v: 4, l: '큼' }, { v: 5, l: '매우 큼' },
];
const ABILITY = [
  { v: 1, l: '못 한다' }, { v: 2, l: '어렵다' }, { v: 3, l: '보통' }, { v: 4, l: '쉽다' }, { v: 5, l: '아주 쉽다' },
];
const SEED = ['매일 100페이지 읽기', '매일 30분 읽기', '잠들기 전 1페이지 읽기', '읽은 책 서평 쓰기', '출퇴근길 오디오북 듣기'];
const STEP_LABELS = ['행동 모으기', '1판 · 영향력', '2판 · 능력', '겹쳐 보기'];
const TAG_COLORS = {
  gold: 'bg-green-100 text-green-700',
  cut: 'bg-yellow-100 text-yellow-700',
  hold: 'bg-gray-100 text-gray-600',
  drop: 'bg-red-100 text-red-500',
};

function uid() {
  return 'b' + Math.random().toString(36).slice(2, 8);
}

function jitter(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return { x: (h % 7) - 3, y: (Math.floor(h / 7) % 7) - 3 };
}

function verdictOf(it) {
  const hi = it.impact >= 4;
  const ha = it.ability >= 4;
  if (hi && ha) return { k: 'gold', t: '황금 행동' };
  if (hi && !ha) return { k: 'cut', t: '쪼개기' };
  if (!hi && ha) return { k: 'hold', t: '보류' };
  return { k: 'drop', t: '버리기' };
}

// Design Ref: §2.0 — Option C(Pragmatic): 목록/세션 훅만 분리, 레이아웃은 이 컴포넌트가 겸함
export default function FocusMap({ addTask }) {
  const { list, loaded: listLoaded, error: listError, refresh: refreshList, removeFocusMap } = useFocusMapList();
  const [activeId, setActiveId] = useState(null);
  const { state, loaded, error: sessionError, update, commit } = useFocusMap(activeId, { onSaved: refreshList });
  const [behInput, setBehInput] = useState('');
  const [status0, setStatus0] = useState('');
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [convertStatus, setConvertStatus] = useState('');

  // 활성 세션이 바뀌면 결과 화면의 체크/변환 상태를 초기화
  useEffect(() => { setCheckedIds(new Set()); setConvertStatus(''); }, [activeId]);

  // 저장된 세션의 cursor가 items 범위를 벗어난 경우 다음 단계로 넘어간다
  useEffect(() => {
    if ((state.step === 1 || state.step === 2) && !state.items[state.cursor]) {
      update((prev) => ({ ...prev, cursor: 0, step: prev.step === 1 ? 2 : 3 }));
    }
  }, [state.step, state.cursor, state.items, update]);

  useEffect(() => {
    function onKeyDown(e) {
      if (state.step !== 1 && state.step !== 2) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 5) pick(n);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  function selectFocusMap(id) {
    setActiveId(id);
  }

  function createNewFocusMap() {
    setActiveId(null);
    setBehInput('');
    setStatus0('');
  }

  async function deleteFocusMapEntry(id) {
    await removeFocusMap(id);
    if (id === activeId) setActiveId(null);
  }

  if (!loaded || !listLoaded) {
    return (
      <div className="h-full flex min-h-0">
        <FocusMapList
          list={list} activeId={activeId} loaded={listLoaded} error={listError}
          onSelect={selectFocusMap} onDelete={deleteFocusMapEntry} onCreateNew={createNewFocusMap}
        />
        <div className="flex-1 p-4 text-sm text-gray-400">불러오는 중...</div>
      </div>
    );
  }

  function addBeh() {
    const v = behInput.trim();
    if (!v) return;
    if (state.items.length >= 12) {
      setStatus0('12개면 충분하다. 더 늘리면 판단이 흐려진다.');
      return;
    }
    update((prev) => ({ ...prev, items: [...prev.items, { id: uid(), text: v, impact: null, ability: null }] }));
    setBehInput('');
    setStatus0('');
  }

  function removeBeh(id) {
    update((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  function seedItems() {
    update((prev) => {
      const goal = prev.goal || '매일 책 읽기';
      const existing = new Set(prev.items.map((x) => x.text));
      const additions = SEED.filter((t) => !existing.has(t)).map((t) => ({ id: uid(), text: t, impact: null, ability: null }));
      return { ...prev, goal, items: [...prev.items, ...additions] };
    });
  }

  // Plan SC: 저장된 목표를 목록에서 선택해 이어보기 — "영향력부터 매기기" 시점에 최초 저장(commit)
  async function toStep1() {
    const next = {
      ...state,
      items: state.items.map((it) => ({ ...it, impact: null, ability: null })),
      step: 1,
      cursor: 0,
    };
    if (activeId == null) {
      if (!next.goal.trim()) { setStatus0('목표를 입력해주세요.'); return; }
      try {
        const created = await commit(next);
        setActiveId(created.id);
        refreshList();
      } catch (e) {
        setStatus0(e.message);
        return;
      }
    } else {
      update(() => next);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pick(v) {
    update((prev) => {
      const items = prev.items.slice();
      const it = { ...items[prev.cursor] };
      if (prev.step === 1) it.impact = v; else it.ability = v;
      items[prev.cursor] = it;
      let cursor = prev.cursor + 1;
      let step = prev.step;
      if (cursor >= items.length) {
        cursor = 0;
        step = prev.step === 1 ? 2 : 3;
      }
      return { ...prev, items, cursor, step };
    });
  }

  function back() {
    update((prev) => {
      if (prev.cursor > 0) return { ...prev, cursor: prev.cursor - 1 };
      if (prev.step === 2) return { ...prev, step: 1, cursor: prev.items.length - 1 };
      return { ...prev, step: 0 };
    });
  }

  function redo() {
    update((prev) => ({
      ...prev,
      items: prev.items.map((it) => ({ ...it, impact: null, ability: null })),
      step: 1,
      cursor: 0,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // "처음부터"는 다중 세션 구조에서 "이 목표를 삭제하고 새로 시작"을 의미한다 (FR-10 삭제 기능 재사용)
  async function handleReset() {
    if (activeId != null) {
      await deleteFocusMapEntry(activeId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleChecked(itemId) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  // Plan SC: 겹쳐 보기 결과에서 선택한 항목을 기존 tasks 백로그로 전환
  // Design Ref: §2.2 — 성공한 항목의 id만 addedTaskIds에 반영 (일부 실패해도 이미 추가된 항목은 유지)
  async function convertSelectedToTasks() {
    const targets = state.items.filter((it) => checkedIds.has(it.id));
    if (!targets.length) return;
    const addedIds = [];
    let failed = 0;
    for (const it of targets) {
      try {
        await addTask(it.text);
        addedIds.push(it.id);
      } catch (e) {
        failed++;
      }
    }
    if (addedIds.length) {
      update((prev) => ({ ...prev, addedTaskIds: [...prev.addedTaskIds, ...addedIds] }));
      setCheckedIds((prev) => {
        const next = new Set(prev);
        addedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    setConvertStatus(
      failed ? `${addedIds.length}개를 할일로 추가했습니다. ${failed}개는 실패했습니다.` : `${addedIds.length}개를 할일로 추가했습니다.`
    );
  }

  const inkLabel = state.step === 1 ? '1판 · 영향력만' : state.step === 2 ? '2판 · 능력만' : state.step === 3 ? '겹쳐 보기' : '2단계 필터';

  return (
    <div className="h-full flex min-h-0">
      <FocusMapList
        list={list} activeId={activeId} loaded={listLoaded} error={listError}
        onSelect={selectFocusMap} onDelete={deleteFocusMapEntry} onCreateNew={createNewFocusMap}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 max-w-3xl mx-auto">
          <div className="text-xs font-medium text-gray-400 mb-1">BJ 포그 · 행동 설계 · {inkLabel}</div>
          <h1 className="text-2xl font-bold text-gray-800">포커스 맵</h1>
          {sessionError && <p className="text-xs text-red-500 mt-1">{sessionError}</p>}
          <p className="text-sm text-gray-500 mt-2 max-w-md">영향력과 실행 가능성을 한꺼번에 재면 좋은 행동이 먼저 탈락한다. 여기서는 두 판을 따로 찍고, 마지막에 겹쳐 본다.</p>

          <div className="flex border rounded-lg overflow-hidden my-4 text-xs">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={
                  'flex-1 text-center py-2 px-1 border-r last:border-r-0 ' +
                  (i === state.step
                    ? 'bg-blue-500 text-white font-semibold'
                    : i < state.step
                      ? 'bg-white text-gray-700'
                      : 'bg-gray-50 text-gray-400')
                }
              >
                {label}
              </div>
            ))}
          </div>

          {state.step === 0 && (
            <section className="bg-white border rounded-lg p-4">
              <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="fm-goal">목표</label>
              <input
                type="text"
                id="fm-goal"
                placeholder="예: 스트레스 줄이기, 매일 책 읽기"
                autoComplete="off"
                disabled={activeId != null}
                value={state.goal}
                onChange={(e) => update((prev) => ({ ...prev, goal: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {activeId != null && <div className="text-[11px] text-gray-400 mt-1">저장된 목표는 이름을 바꿀 수 없습니다. 다른 이름을 쓰려면 "새 목표 시작"을 눌러주세요.</div>}

              <label className="block text-xs font-medium text-gray-500 mt-4 mb-1" htmlFor="fm-beh">목표에 도움이 될 만한 행동 (효과 여부는 아직 따지지 않는다)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="fm-beh"
                  placeholder="행동 하나를 적고 Enter"
                  autoComplete="off"
                  value={behInput}
                  onChange={(e) => setBehInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBeh(); } }}
                  className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button onClick={addBeh} className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">추가</button>
              </div>

              {state.items.length === 0 ? (
                <div className="mt-4 p-4 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded">
                  행동을 3개 이상 모아 보자. 지금은 좋은 행동인지 판단하지 않는다. 떠오르는 대로 적는 단계다.
                </div>
              ) : (
                <ul className="mt-4 border-t border-gray-100 divide-y divide-gray-100">
                  {state.items.map((it, i) => (
                    <li key={it.id} className="flex items-center gap-3 py-2">
                      <span className="text-xs text-gray-300 w-5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 text-sm text-gray-700">{it.text}</span>
                      <button onClick={() => removeBeh(it.id)} aria-label="삭제" className="text-gray-400 hover:text-red-500 text-xs">지우기</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2 mt-4">
                <button
                  disabled={state.items.length < 2 || (activeId == null && !state.goal.trim())}
                  onClick={toStep1}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  영향력부터 매기기
                </button>
                <button onClick={seedItems} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">예시로 채우기</button>
                <span className="text-xs text-gray-400 ml-auto">{state.items.length}개</span>
              </div>
              {status0 && <div className="text-xs text-gray-400 mt-2">{status0}</div>}
            </section>
          )}

          {(state.step === 1 || state.step === 2) && state.items[state.cursor] && (() => {
            const isImpact = state.step === 1;
            const opts = isImpact ? IMPACT : ABILITY;
            const it = state.items[state.cursor];
            return (
              <section className="bg-white border rounded-lg p-4">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-2xl font-bold text-blue-500">{isImpact ? '1' : '2'}</span>
                  <span className="text-base font-semibold text-gray-800">{isImpact ? '이 행동은 목표를 얼마나 바꾸는가' : '지금 당장 할 수 있는가'}</span>
                  <span className="text-xs text-gray-400 ml-auto">{state.cursor + 1} / {state.items.length}</span>
                </div>
                <p className="text-xs text-gray-500 border-l-2 border-blue-300 pl-2 my-4">
                  {isImpact
                    ? '시간·의지·현실은 지금 계산에서 뺀다. 효과만 본다.'
                    : '효과는 잊는다. 오늘 저녁에 실제로 할 수 있는지만 본다. 1판 점수는 일부러 가려 두었다.'}
                </p>
                <div className="p-5 border rounded-lg bg-gray-50 text-lg font-semibold text-gray-800 mb-4">{it.text}</div>
                <div className="grid grid-cols-5 gap-2">
                  {opts.map((o) => (
                    <button
                      key={o.v}
                      onClick={() => pick(o.v)}
                      className="group border rounded-lg py-3 px-1 flex flex-col items-center gap-1 hover:bg-blue-500 hover:border-blue-500 transition-colors"
                    >
                      <b className="text-base font-semibold text-gray-800 group-hover:text-white">{o.v}</b>
                      <span className="text-[11px] text-gray-500 text-center group-hover:text-white">{o.l}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={back} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                    {state.cursor === 0 && state.step === 1 ? '행동 목록으로' : '이전'}
                  </button>
                  <span className="text-xs text-gray-400">키보드 1–5 로도 고를 수 있다</span>
                </div>
              </section>
            );
          })()}

          {state.step === 3 && (() => {
            const golds = state.items.filter((it) => verdictOf(it).k === 'gold');
            const cuts = state.items.filter((it) => verdictOf(it).k === 'cut');
            const sorted = state.items
              .map((it, i) => ({ it, i }))
              .sort((a, b) => {
                const order = { gold: 0, cut: 1, hold: 2, drop: 3 };
                const d = order[verdictOf(a.it).k] - order[verdictOf(b.it).k];
                return d !== 0 ? d : (b.it.impact + b.it.ability) - (a.it.impact + a.it.ability);
              });
            const addedTaskIds = state.addedTaskIds || [];

            return (
              <section>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-2xl font-bold text-blue-500">3</span>
                  <span className="text-base font-semibold text-gray-800">{state.goal ? state.goal : '두 판을 겹친 결과'}</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">분홍은 영향력, 파랑은 능력. 두 잉크가 겹친 자리에 있는 행동이 지금 습관으로 만들 행동이다.</p>

                <div className="grid gap-1.5" style={{ gridTemplateColumns: '24px 1fr', gridTemplateRows: '1fr 24px' }}>
                  <div
                    className="flex items-center justify-center text-[11px] text-gray-400"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    영향력 →
                  </div>
                  <div className="relative aspect-square border rounded-lg bg-gray-50 overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-pink-100/50 pointer-events-none" />
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-blue-100/50 pointer-events-none" />
                    {[25, 50, 75].flatMap((p) => ([
                      <div key={`h-${p}`} className="absolute bg-gray-200 pointer-events-none" style={{ left: 0, right: 0, top: `${p}%`, height: 1 }} />,
                      <div key={`v-${p}`} className="absolute bg-gray-200 pointer-events-none" style={{ top: 0, bottom: 0, left: `${p}%`, width: 1 }} />,
                    ]))}
                    <div className="absolute top-0 right-0 w-1/2 h-1/2 flex items-start justify-end p-2 text-[10px] tracking-wide text-green-600 pointer-events-none">황금 행동</div>
                    <div className="absolute left-0 bottom-0 p-1.5 text-[10px] text-gray-400 pointer-events-none">버리기</div>
                    <div className="absolute right-0 bottom-0 p-1.5 text-[10px] text-gray-400 pointer-events-none">보류</div>
                    <div className="absolute left-0 top-0 p-1.5 text-[10px] text-gray-400 pointer-events-none">쪼개기</div>
                    {state.items.map((it, i) => {
                      const j = jitter(it.id);
                      const isGold = verdictOf(it).k === 'gold';
                      return (
                        <div
                          key={it.id}
                          title={it.text}
                          className={
                            'absolute w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all hover:scale-125 hover:z-10 ' +
                            (isGold ? 'bg-green-500 text-white border-green-500 ring-4 ring-green-200' : 'bg-white text-gray-700 border-gray-300')
                          }
                          style={{
                            left: `${10 + ((it.ability - 1) / 4) * 80}%`,
                            top: `${90 - ((it.impact - 1) / 4) * 80}%`,
                            marginLeft: -14 + j.x,
                            marginTop: -14 + j.y,
                          }}
                        >
                          {i + 1}
                        </div>
                      );
                    })}
                  </div>
                  <div />
                  <div className="flex items-center justify-center text-[11px] text-gray-400">능력 →</div>
                </div>

                {golds.length ? (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="text-xs font-semibold text-green-700 mb-1">지금 시작할 행동</h3>
                    <p className="text-base font-semibold text-green-800">{golds.map((g) => g.text).join(' · ')}</p>
                    <p className="text-xs text-green-600 mt-2">영향력이 조금 낮아도 매일 되는 행동이 이긴다. 지속이 쌓이면 총효과가 커진다.</p>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-xs font-semibold text-gray-500 mb-1">겹치는 자리가 비었다</h3>
                    <p className="text-base font-semibold text-gray-700">효과와 실행 가능성이 함께 높은 행동이 아직 없다.</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {cuts.length
                        ? `「${cuts[0].text}」처럼 효과 큰 행동을 더 작게 잘라 목록에 다시 넣어 보자. 30분이 아니라 2분짜리로.`
                        : '효과가 큰 행동을 몇 개 더 적어 보자. 지금 목록은 전부 가볍기만 하다.'}
                    </p>
                  </div>
                )}

                <table className="w-full mt-6 text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b">
                      <th className="text-left font-normal py-2 w-6"></th>
                      <th className="text-left font-normal py-2 w-6"></th>
                      <th className="text-left font-normal py-2">행동</th>
                      <th className="text-left font-normal py-2 w-20">영향</th>
                      <th className="text-left font-normal py-2 w-20">능력</th>
                      <th className="text-left font-normal py-2">판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(({ it, i }) => {
                      const v = verdictOf(it);
                      const isAdded = addedTaskIds.includes(it.id);
                      return (
                        <tr key={it.id} className="border-b border-gray-100">
                          <td className="py-2">
                            {isAdded ? (
                              <span className="text-[10px] text-gray-400">추가됨</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={checkedIds.has(it.id)}
                                onChange={() => toggleChecked(it.id)}
                                aria-label={`${it.text} 선택`}
                              />
                            )}
                          </td>
                          <td className="py-2 text-xs text-gray-300">{String(i + 1).padStart(2, '0')}</td>
                          <td className="py-2 text-gray-700">{it.text}</td>
                          <td className="py-2 text-gray-800">{'■'.repeat(it.impact)}</td>
                          <td className="py-2 text-gray-800">{'■'.repeat(it.ability)}</td>
                          <td className="py-2"><span className={'px-2 py-0.5 rounded text-xs font-medium ' + TAG_COLORS[v.k]}>{v.t}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={convertSelectedToTasks}
                    disabled={checkedIds.size === 0}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    선택 항목 할일로 추가
                  </button>
                  {convertStatus && <span className="text-xs text-gray-500">{convertStatus}</span>}
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={redo} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">다시 매기기</button>
                  <button onClick={handleReset} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">삭제하고 처음부터</button>
                </div>
              </section>
            );
          })()}

          <footer className="mt-10 pt-4 border-t text-xs text-gray-400">
            포커스 매핑(Focus Mapping)은 BJ Fogg, <em>Tiny Habits</em> (2020) 2장 행동 설계 단계의 도구다.{' '}
            <code className="font-mono">영향력 필터 → 능력 필터</code> 순서로 적용하는 것이 핵심.
          </footer>
        </div>
      </div>
    </div>
  );
}
