import { useEffect, useMemo, useState } from 'react';
import { useLongGoals } from '../../hooks/useLongGoals';

const GOAL_STATUS_LABELS = {
  active: '진행',
  paused: '보류',
  done: '완료',
};

const REQUIREMENT_LABELS = {
  task: '작업',
  work: '업무',
  condition: '조건',
};

const REWARD_LABELS = {
  wife: '아내',
  kids: '아이들',
  self: '나',
};

const BUCKET_LABELS = {
  achievement: '성취',
  experience: '경험/즐거움',
};

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function periodLabel(start, end) {
  if (start && end) return `${dateOnly(start)} ~ ${dateOnly(end)}`;
  if (start) return `${dateOnly(start)} ~`;
  if (end) return `~ ${dateOnly(end)}`;
  return '기간 미정';
}

function dayValue(value) {
  if (!value) return null;
  const time = new Date(`${dateOnly(value)}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time / 86400000;
}

function progress(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function createEmptyGoalForm() {
  return { title: '', period_start: '', period_end: '', description: '' };
}

function createEmptySubgoalForm() {
  return { title: '', period_start: '', period_end: '', notes: '' };
}

function createEmptyRequirementForm() {
  return { kind: 'task', title: '', notes: '' };
}

function createEmptyRewardForm() {
  return { recipient: 'self', title: '', notes: '' };
}

function createEmptyBucketForm() {
  return { category: 'experience', title: '', notes: '' };
}

function MilestoneView({ goal }) {
  const dated = goal.subgoals.filter((item) => item.period_start || item.period_end);
  const bounds = useMemo(() => {
    const values = [
      dayValue(goal.period_start),
      dayValue(goal.period_end),
      ...dated.flatMap((item) => [dayValue(item.period_start), dayValue(item.period_end)]),
    ].filter((value) => value != null);
    if (!values.length) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [goal.period_start, goal.period_end, dated]);

  if (!dated.length || !bounds) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center border rounded border-dashed">
        기간이 지정된 세부 목표가 없습니다.
      </div>
    );
  }

  const span = Math.max(bounds.max - bounds.min, 1);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{goal.period_start ? dateOnly(goal.period_start) : '시작'}</span>
        <span>{goal.period_end ? dateOnly(goal.period_end) : '종료'}</span>
      </div>
      {dated.map((item) => {
        const start = dayValue(item.period_start) ?? bounds.min;
        const end = dayValue(item.period_end) ?? start;
        const left = Math.max(0, Math.min(100, ((start - bounds.min) / span) * 100));
        const width = Math.max(8, Math.min(100 - left, ((Math.max(end, start) - start + 1) / span) * 100));
        return (
          <div key={item.id} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 items-center">
            <div className="min-w-0">
              <div className={'text-sm truncate ' + (item.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700')}>
                {item.title}
              </div>
              <div className="text-xs text-gray-400">{periodLabel(item.period_start, item.period_end)}</div>
            </div>
            <div className="h-7 rounded bg-gray-100 relative overflow-hidden">
              <div
                className={
                  'absolute top-1 bottom-1 rounded ' +
                  (item.status === 'done' ? 'bg-emerald-300' : 'bg-blue-400')
                }
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LongGoals() {
  const {
    goals,
    bucketItems,
    loaded,
    addGoal,
    updateGoal,
    removeGoal,
    addSubgoal,
    updateSubgoal,
    removeSubgoal,
    addRequirement,
    updateRequirement,
    removeRequirement,
    addReward,
    updateReward,
    removeReward,
    addBucketItem,
    updateBucketItem,
    removeBucketItem,
  } = useLongGoals();

  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [goalForm, setGoalForm] = useState(createEmptyGoalForm);
  const [subgoalForm, setSubgoalForm] = useState(createEmptySubgoalForm);
  const [requirementForm, setRequirementForm] = useState(createEmptyRequirementForm);
  const [rewardForm, setRewardForm] = useState(createEmptyRewardForm);
  const [bucketForm, setBucketForm] = useState(createEmptyBucketForm);
  const [editingSubgoalId, setEditingSubgoalId] = useState(null);
  const [subgoalEditForm, setSubgoalEditForm] = useState(createEmptySubgoalForm);
  const [editingRequirementId, setEditingRequirementId] = useState(null);
  const [requirementEditForm, setRequirementEditForm] = useState(createEmptyRequirementForm);
  const [editingRewardId, setEditingRewardId] = useState(null);
  const [rewardEditForm, setRewardEditForm] = useState(createEmptyRewardForm);

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0] ?? null;

  useEffect(() => {
    if (!selectedGoal && goals[0]) setSelectedGoalId(goals[0].id);
    if (selectedGoal && selectedGoal.id !== selectedGoalId) setSelectedGoalId(selectedGoal.id);
  }, [goals, selectedGoal, selectedGoalId]);

  const goalStats = selectedGoal ? {
    subDone: selectedGoal.subgoals.filter((item) => item.status === 'done').length,
    subTotal: selectedGoal.subgoals.length,
    reqDone: selectedGoal.requirements.filter((item) => item.status === 'done').length,
    reqTotal: selectedGoal.requirements.length,
  } : { subDone: 0, subTotal: 0, reqDone: 0, reqTotal: 0 };

  const submitGoal = async (e) => {
    e.preventDefault();
    try {
      const goal = await addGoal(goalForm);
      setGoalForm(createEmptyGoalForm());
      setSelectedGoalId(goal.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const submitSubgoal = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      await addSubgoal(selectedGoal.id, subgoalForm);
      setSubgoalForm(createEmptySubgoalForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditSubgoal = (item) => {
    setEditingSubgoalId(item.id);
    setSubgoalEditForm({
      title: item.title ?? '',
      period_start: dateOnly(item.period_start),
      period_end: dateOnly(item.period_end),
      notes: item.notes ?? '',
    });
  };

  const cancelEditSubgoal = () => {
    setEditingSubgoalId(null);
    setSubgoalEditForm(createEmptySubgoalForm());
  };

  const saveSubgoalEdit = async (id) => {
    try {
      await updateSubgoal(id, subgoalEditForm);
      cancelEditSubgoal();
    } catch (err) {
      alert(err.message);
    }
  };

  const submitRequirement = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      await addRequirement(selectedGoal.id, requirementForm);
      setRequirementForm(createEmptyRequirementForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const submitReward = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      await addReward(selectedGoal.id, rewardForm);
      setRewardForm(createEmptyRewardForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditRequirement = (item) => {
    setEditingRequirementId(item.id);
    setRequirementEditForm({ kind: item.kind, title: item.title ?? '', notes: item.notes ?? '' });
  };

  const cancelEditRequirement = () => {
    setEditingRequirementId(null);
    setRequirementEditForm(createEmptyRequirementForm());
  };

  const saveRequirementEdit = async (id) => {
    try {
      await updateRequirement(id, requirementEditForm);
      cancelEditRequirement();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditReward = (item) => {
    setEditingRewardId(item.id);
    setRewardEditForm({ recipient: item.recipient, title: item.title ?? '', notes: item.notes ?? '' });
  };

  const cancelEditReward = () => {
    setEditingRewardId(null);
    setRewardEditForm(createEmptyRewardForm());
  };

  const saveRewardEdit = async (id) => {
    try {
      await updateReward(id, rewardEditForm);
      cancelEditReward();
    } catch (err) {
      alert(err.message);
    }
  };

  const submitBucket = async (e) => {
    e.preventDefault();
    try {
      await addBucketItem(bucketForm);
      setBucketForm(createEmptyBucketForm());
    } catch (err) {
      alert(err.message);
    }
  };

  if (!loaded) {
    return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <aside className="space-y-4">
          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold text-gray-800 mb-3">장기목표</h2>
            <form onSubmit={submitGoal} className="space-y-2">
              <input
                value={goalForm.title}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="목표 제목"
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={goalForm.period_start}
                  onChange={(e) => setGoalForm((prev) => ({ ...prev, period_start: e.target.value }))}
                  className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  type="date"
                  value={goalForm.period_end}
                  onChange={(e) => setGoalForm((prev) => ({ ...prev, period_end: e.target.value }))}
                  className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <textarea
                value={goalForm.description}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="목표 설명"
                rows="3"
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
              <button type="submit" className="w-full px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                추가
              </button>
            </form>
          </section>

          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold text-gray-800 mb-3">목표 목록</h2>
            <div className="space-y-2">
              {goals.map((goal) => {
                const done = goal.subgoals.filter((item) => item.status === 'done').length;
                const total = goal.subgoals.length;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setSelectedGoalId(goal.id)}
                    className={
                      'w-full text-left p-3 rounded border transition-colors ' +
                      (selectedGoal?.id === goal.id ? 'border-blue-400 bg-blue-50' : 'bg-gray-50 hover:bg-gray-100')
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-gray-800">{goal.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white border text-gray-500">
                        {GOAL_STATUS_LABELS[goal.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">{periodLabel(goal.period_start, goal.period_end)}</div>
                    <div className="mt-2 h-1.5 rounded bg-gray-200 overflow-hidden">
                      <div className="h-full bg-blue-400" style={{ width: `${progress(done, total)}%` }} />
                    </div>
                  </button>
                );
              })}
              {goals.length === 0 && (
                <div className="p-4 text-sm text-gray-400 text-center border rounded border-dashed">
                  장기목표가 없습니다.
                </div>
              )}
            </div>
          </section>
        </aside>

        <main className="space-y-4 min-w-0">
          {selectedGoal ? (
            <>
              <section className="bg-white border rounded p-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-gray-900 break-words">{selectedGoal.title}</h2>
                    <div className="mt-1 text-sm text-gray-500">{periodLabel(selectedGoal.period_start, selectedGoal.period_end)}</div>
                    {selectedGoal.description && (
                      <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{selectedGoal.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(GOAL_STATUS_LABELS).map(([status, label]) => (
                      <button
                        key={status}
                        onClick={async () => {
                          try {
                            await updateGoal(selectedGoal.id, { status });
                          } catch (err) {
                            alert(err.message);
                          }
                        }}
                        className={
                          'px-3 py-1.5 text-xs font-semibold rounded border ' +
                          (selectedGoal.status === status
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 hover:bg-gray-50')
                        }
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={async () => {
                        if (!window.confirm('선택한 장기목표와 하위 항목을 삭제할까요?')) return;
                        try {
                          await removeGoal(selectedGoal.id);
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded border bg-white text-red-500 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 rounded border bg-gray-50">
                    <div className="text-xs text-gray-400">세부 목표</div>
                    <div className="text-lg font-semibold text-gray-800">{goalStats.subDone}/{goalStats.subTotal}</div>
                  </div>
                  <div className="p-3 rounded border bg-gray-50">
                    <div className="text-xs text-gray-400">필요 항목</div>
                    <div className="text-lg font-semibold text-gray-800">{goalStats.reqDone}/{goalStats.reqTotal}</div>
                  </div>
                </div>
              </section>

              <section className="bg-white border rounded p-4">
                <h2 className="font-semibold text-gray-800 mb-3">마일스톤</h2>
                <MilestoneView goal={selectedGoal} />
              </section>

              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <section className="bg-white border rounded p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">세부 목표</h2>
                  <form onSubmit={submitSubgoal} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_140px_72px] gap-2 mb-3">
                    <input
                      value={subgoalForm.title}
                      onChange={(e) => setSubgoalForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="세부 목표"
                      className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <input
                      type="date"
                      value={subgoalForm.period_start}
                      onChange={(e) => setSubgoalForm((prev) => ({ ...prev, period_start: e.target.value }))}
                      className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <input
                      type="date"
                      value={subgoalForm.period_end}
                      onChange={(e) => setSubgoalForm((prev) => ({ ...prev, period_end: e.target.value }))}
                      className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                      추가
                    </button>
                    <input
                      value={subgoalForm.notes}
                      onChange={(e) => setSubgoalForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="메모"
                      className="md:col-span-4 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </form>
                  <div className="space-y-2">
                    {selectedGoal.subgoals.map((item) => (
                      editingSubgoalId === item.id ? (
                        <div key={item.id} className="p-2 rounded border bg-blue-50 space-y-2">
                          <input
                            value={subgoalEditForm.title}
                            onChange={(e) => setSubgoalEditForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="세부 목표"
                            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={subgoalEditForm.period_start}
                              onChange={(e) => setSubgoalEditForm((prev) => ({ ...prev, period_start: e.target.value }))}
                              className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <input
                              type="date"
                              value={subgoalEditForm.period_end}
                              onChange={(e) => setSubgoalEditForm((prev) => ({ ...prev, period_end: e.target.value }))}
                              className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                          <input
                            value={subgoalEditForm.notes}
                            onChange={(e) => setSubgoalEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder="메모"
                            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditSubgoal}
                              className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => saveSubgoalEdit(item.id)}
                              disabled={!subgoalEditForm.title.trim()}
                              className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} className="flex items-start gap-2 p-2 rounded border bg-gray-50">
                          <input
                            type="checkbox"
                            checked={item.status === 'done'}
                            onChange={async (e) => {
                              try {
                                await updateSubgoal(item.id, { status: e.target.checked ? 'done' : 'open' });
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className={'text-sm break-words ' + (item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800')}>
                              {item.title}
                            </div>
                            <div className="text-xs text-gray-400">{periodLabel(item.period_start, item.period_end)}</div>
                            {item.notes && <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{item.notes}</div>}
                          </div>
                          <button
                            onClick={() => startEditSubgoal(item)}
                            title="수정"
                            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await removeSubgoal(item.id);
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                </section>

                <section className="bg-white border rounded p-4">
                  <h2 className="font-semibold text-gray-800 mb-3">필요 항목</h2>
                  <form onSubmit={submitRequirement} className="grid grid-cols-1 md:grid-cols-[110px_minmax(0,1fr)_72px] gap-2 mb-3">
                    <select
                      value={requirementForm.kind}
                      onChange={(e) => setRequirementForm((prev) => ({ ...prev, kind: e.target.value }))}
                      className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      {Object.entries(REQUIREMENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <input
                      value={requirementForm.title}
                      onChange={(e) => setRequirementForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="작업, 업무, 조건"
                      className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                      추가
                    </button>
                    <input
                      value={requirementForm.notes}
                      onChange={(e) => setRequirementForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="메모"
                      className="md:col-span-3 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </form>
                  <div className="space-y-2">
                    {selectedGoal.requirements.map((item) => (
                      editingRequirementId === item.id ? (
                        <div key={item.id} className="p-2 rounded border bg-blue-50 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-[110px_minmax(0,1fr)] gap-2">
                            <select
                              value={requirementEditForm.kind}
                              onChange={(e) => setRequirementEditForm((prev) => ({ ...prev, kind: e.target.value }))}
                              className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                              {Object.entries(REQUIREMENT_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                            <input
                              value={requirementEditForm.title}
                              onChange={(e) => setRequirementEditForm((prev) => ({ ...prev, title: e.target.value }))}
                              placeholder="작업, 업무, 조건"
                              className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                          <input
                            value={requirementEditForm.notes}
                            onChange={(e) => setRequirementEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder="메모"
                            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditRequirement}
                              className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => saveRequirementEdit(item.id)}
                              disabled={!requirementEditForm.title.trim()}
                              className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} className="flex items-start gap-2 p-2 rounded border bg-gray-50">
                          <input
                            type="checkbox"
                            checked={item.status === 'done'}
                            onChange={async (e) => {
                              try {
                                await updateRequirement(item.id, { status: e.target.checked ? 'done' : 'open' });
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 text-[11px] rounded bg-white border text-gray-500">
                                {REQUIREMENT_LABELS[item.kind]}
                              </span>
                              <span className={'text-sm break-words ' + (item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800')}>
                                {item.title}
                              </span>
                            </div>
                            {item.notes && <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{item.notes}</div>}
                          </div>
                          <button
                            onClick={() => startEditRequirement(item)}
                            title="수정"
                            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await removeRequirement(item.id);
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                </section>
              </div>

              <section className="bg-white border rounded p-4">
                <h2 className="font-semibold text-gray-800 mb-3">보상</h2>
                <form onSubmit={submitReward} className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)_72px] gap-2 mb-3">
                  <select
                    value={rewardForm.recipient}
                    onChange={(e) => setRewardForm((prev) => ({ ...prev, recipient: e.target.value }))}
                    className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {Object.entries(REWARD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    value={rewardForm.title}
                    onChange={(e) => setRewardForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="하고 싶은 일 또는 보상"
                    className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    추가
                  </button>
                  <input
                    value={rewardForm.notes}
                    onChange={(e) => setRewardForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="메모"
                    className="md:col-span-3 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </form>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.entries(REWARD_LABELS).map(([recipient, label]) => (
                    <div key={recipient} className="rounded border bg-gray-50 p-3">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
                      <div className="space-y-2">
                        {selectedGoal.rewards.filter((item) => item.recipient === recipient).map((item) => (
                          editingRewardId === item.id ? (
                            <div key={item.id} className="p-2 rounded border bg-blue-50 space-y-2">
                              <select
                                value={rewardEditForm.recipient}
                                onChange={(e) => setRewardEditForm((prev) => ({ ...prev, recipient: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                              >
                                {Object.entries(REWARD_LABELS).map(([value, rlabel]) => (
                                  <option key={value} value={value}>{rlabel}</option>
                                ))}
                              </select>
                              <input
                                value={rewardEditForm.title}
                                onChange={(e) => setRewardEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="하고 싶은 일 또는 보상"
                                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                              <input
                                value={rewardEditForm.notes}
                                onChange={(e) => setRewardEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="메모"
                                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={cancelEditReward}
                                  className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={() => saveRewardEdit(item.id)}
                                  disabled={!rewardEditForm.title.trim()}
                                  className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div key={item.id} className="p-2 rounded bg-white border">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-gray-800 break-words">{item.title}</div>
                                  {item.notes && <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{item.notes}</div>}
                                </div>
                                <button
                                  onClick={() => startEditReward(item)}
                                  title="수정"
                                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await removeReward(item.id);
                                    } catch (err) {
                                      alert(err.message);
                                    }
                                  }}
                                  className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="bg-white border rounded p-8 text-center text-sm text-gray-400">
              장기목표를 추가해주세요.
            </section>
          )}

          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold text-gray-800 mb-3">버킷리스트</h2>
            <form onSubmit={submitBucket} className="grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)_72px] gap-2 mb-3">
              <select
                value={bucketForm.category}
                onChange={(e) => setBucketForm((prev) => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {Object.entries(BUCKET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                value={bucketForm.title}
                onChange={(e) => setBucketForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="버킷리스트"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                추가
              </button>
              <input
                value={bucketForm.notes}
                onChange={(e) => setBucketForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="메모"
                className="md:col-span-3 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(BUCKET_LABELS).map(([category, label]) => (
                <div key={category} className="rounded border bg-gray-50 p-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
                  <div className="space-y-2">
                    {bucketItems.filter((item) => item.category === category).map((item) => (
                      <div key={item.id} className="flex items-start gap-2 p-2 rounded bg-white border">
                        <input
                          type="checkbox"
                          checked={item.status === 'done'}
                          onChange={async (e) => {
                            try {
                              await updateBucketItem(item.id, { status: e.target.checked ? 'done' : 'open' });
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={'text-sm break-words ' + (item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800')}>
                            {item.title}
                          </div>
                          {item.notes && <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{item.notes}</div>}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await removeBucketItem(item.id);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                          className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
