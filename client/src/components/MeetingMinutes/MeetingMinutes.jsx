import { useState } from 'react';
import DateNavigator from '../DateNavigator';
import { useMeetings } from '../../hooks/useMeetings';

// Design Ref: §2 Option A — LongGoals.jsx의 목록/상세 + editingXId/xEditForm 인라인 편집 패턴을 그대로 재사용

const OVERALL_KIND_LABELS = { share: '공유', request: '요청', project: '진행프로젝트' };
const ACTION_STATUSES = ['대기', '진행중', '완료'];

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

function createEmptyOverallForm() {
  return { kind: 'share', content: '' };
}

function createEmptyPartForm() {
  return { assignee: '', progress: '', request: '' };
}

function createEmptyActionForm() {
  return { task_type: '', content: '', status: '대기', due_date: '', assignee: '' };
}

export default function MeetingMinutes() {
  const {
    meetings,
    loaded,
    selectedId,
    detail,
    generating,
    generateError,
    selectMeeting,
    backToList,
    addMeeting,
    removeMeeting,
    addOverallItem,
    updateOverallItem,
    removeOverallItem,
    addPartItem,
    updatePartItem,
    removePartItem,
    addActionItem,
    updateActionItem,
    removeActionItem,
    generateActionItems,
  } = useMeetings();

  const [newDate, setNewDate] = useState(() => toDateString(new Date()));
  const [confirmState, setConfirmState] = useState(null);

  const [overallForm, setOverallForm] = useState(createEmptyOverallForm);
  const [partForm, setPartForm] = useState(createEmptyPartForm);
  const [actionForm, setActionForm] = useState(createEmptyActionForm);
  const [notesText, setNotesText] = useState('');

  const [editingOverallId, setEditingOverallId] = useState(null);
  const [overallEditForm, setOverallEditForm] = useState(createEmptyOverallForm);
  const [editingPartId, setEditingPartId] = useState(null);
  const [partEditForm, setPartEditForm] = useState(createEmptyPartForm);
  const [editingActionId, setEditingActionId] = useState(null);
  const [actionEditForm, setActionEditForm] = useState(createEmptyActionForm);

  const submitMeeting = async (e) => {
    e.preventDefault();
    try {
      const created = await addMeeting({ date: newDate });
      await selectMeeting(created.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const submitOverall = async (e) => {
    e.preventDefault();
    if (!overallForm.content.trim()) return;
    try {
      await addOverallItem(selectedId, overallForm);
      setOverallForm(createEmptyOverallForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditOverall = (item) => {
    setEditingOverallId(item.id);
    setOverallEditForm({ kind: item.kind, content: item.content });
  };
  const cancelEditOverall = () => {
    setEditingOverallId(null);
    setOverallEditForm(createEmptyOverallForm());
  };
  const saveOverallEdit = async (id) => {
    try {
      await updateOverallItem(id, overallEditForm);
      cancelEditOverall();
    } catch (err) {
      alert(err.message);
    }
  };

  const submitPart = async (e) => {
    e.preventDefault();
    if (!partForm.assignee.trim()) return;
    try {
      await addPartItem(selectedId, partForm);
      setPartForm(createEmptyPartForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditPart = (item) => {
    setEditingPartId(item.id);
    setPartEditForm({ assignee: item.assignee, progress: item.progress ?? '', request: item.request ?? '' });
  };
  const cancelEditPart = () => {
    setEditingPartId(null);
    setPartEditForm(createEmptyPartForm());
  };
  const savePartEdit = async (id) => {
    try {
      await updatePartItem(id, partEditForm);
      cancelEditPart();
    } catch (err) {
      alert(err.message);
    }
  };

  const submitAction = async (e) => {
    e.preventDefault();
    if (!actionForm.content.trim()) return;
    try {
      await addActionItem(selectedId, actionForm);
      setActionForm(createEmptyActionForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditAction = (item) => {
    setEditingActionId(item.id);
    setActionEditForm({
      task_type: item.task_type ?? '',
      content: item.content,
      status: item.status,
      due_date: item.due_date ?? '',
      assignee: item.assignee ?? '',
    });
  };
  const cancelEditAction = () => {
    setEditingActionId(null);
    setActionEditForm(createEmptyActionForm());
  };
  const saveActionEdit = async (id) => {
    try {
      await updateActionItem(id, actionEditForm);
      cancelEditAction();
    } catch (err) {
      alert(err.message);
    }
  };

  // Plan SC: FR-12 — 회의 원문 붙여넣기 → AI 자동생성
  const submitGenerate = async () => {
    if (!notesText.trim()) return;
    const ok = await generateActionItems(selectedId, notesText);
    if (ok) setNotesText('');
  };

  const askDeleteMeeting = (meeting) => {
    setConfirmState({
      message: `${meeting.date} 회의록을 삭제할까요? 하위 항목도 함께 삭제됩니다.`,
      onConfirm: () => removeMeeting(meeting.id),
    });
  };

  if (!loaded) {
    return <div className="flex-1 min-h-0 overflow-y-auto p-6 text-sm text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {!selectedId && (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <DateNavigator date={newDate} onChange={setNewDate} />
          <form onSubmit={submitMeeting} className="flex justify-end">
            <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
              + 이 날짜로 회의록 생성
            </button>
          </form>

          <div className="bg-white border rounded divide-y">
            {meetings.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">회의록이 없습니다.</div>
            )}
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                <button
                  onClick={() => selectMeeting(m.id)}
                  className="text-sm font-semibold text-gray-800 hover:text-blue-600"
                >
                  {m.date}
                </button>
                <button
                  onClick={() => askDeleteMeeting(m)}
                  className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedId && detail && (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={backToList} className="px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
              ◀ 목록으로
            </button>
            <h1 className="text-lg font-semibold text-gray-800">{detail.meeting.date} 회의록</h1>
          </div>

          {/* 전체 섹션 */}
          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold text-gray-800 mb-3">전체</h2>
            <form onSubmit={submitOverall} className="grid grid-cols-1 md:grid-cols-[110px_minmax(0,1fr)_72px] gap-2 mb-3">
              <select
                value={overallForm.kind}
                onChange={(e) => setOverallForm((prev) => ({ ...prev, kind: e.target.value }))}
                className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {Object.entries(OVERALL_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                value={overallForm.content}
                onChange={(e) => setOverallForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="내용"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                추가
              </button>
            </form>
            <div className="space-y-2">
              {detail.overall_items.map((item) => (
                editingOverallId === item.id ? (
                  <div key={item.id} className="p-2 rounded border bg-blue-50 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-[110px_minmax(0,1fr)] gap-2">
                      <select
                        value={overallEditForm.kind}
                        onChange={(e) => setOverallEditForm((prev) => ({ ...prev, kind: e.target.value }))}
                        className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        {Object.entries(OVERALL_KIND_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <input
                        value={overallEditForm.content}
                        onChange={(e) => setOverallEditForm((prev) => ({ ...prev, content: e.target.value }))}
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEditOverall} className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                        취소
                      </button>
                      <button
                        onClick={() => saveOverallEdit(item.id)}
                        disabled={!overallEditForm.content.trim()}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="flex items-start gap-2 p-2 rounded border bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <span className="px-2 py-0.5 text-[11px] rounded bg-white border text-gray-500 mr-2">
                        {OVERALL_KIND_LABELS[item.kind]}
                      </span>
                      <span className="text-sm text-gray-800 break-words">{item.content}</span>
                    </div>
                    <button onClick={() => startEditOverall(item)} className="px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600">
                      수정
                    </button>
                    <button
                      onClick={async () => { try { await removeOverallItem(item.id); } catch (err) { alert(err.message); } }}
                      className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* 파트별 섹션 */}
          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold text-gray-800 mb-3">파트별</h2>
            <form onSubmit={submitPart} className="grid grid-cols-1 md:grid-cols-[110px_1fr_1fr_72px] gap-2 mb-3">
              <input
                value={partForm.assignee}
                onChange={(e) => setPartForm((prev) => ({ ...prev, assignee: e.target.value }))}
                placeholder="담당자"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                value={partForm.progress}
                onChange={(e) => setPartForm((prev) => ({ ...prev, progress: e.target.value }))}
                placeholder="진행사항"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                value={partForm.request}
                onChange={(e) => setPartForm((prev) => ({ ...prev, request: e.target.value }))}
                placeholder="요청사항"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                추가
              </button>
            </form>
            <div className="space-y-2">
              {detail.part_items.map((item) => (
                editingPartId === item.id ? (
                  <div key={item.id} className="p-2 rounded border bg-blue-50 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        value={partEditForm.assignee}
                        onChange={(e) => setPartEditForm((prev) => ({ ...prev, assignee: e.target.value }))}
                        placeholder="담당자"
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <input
                        value={partEditForm.progress}
                        onChange={(e) => setPartEditForm((prev) => ({ ...prev, progress: e.target.value }))}
                        placeholder="진행사항"
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <input
                        value={partEditForm.request}
                        onChange={(e) => setPartEditForm((prev) => ({ ...prev, request: e.target.value }))}
                        placeholder="요청사항"
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEditPart} className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                        취소
                      </button>
                      <button
                        onClick={() => savePartEdit(item.id)}
                        disabled={!partEditForm.assignee.trim()}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="flex items-start gap-2 p-2 rounded border bg-gray-50">
                    <div className="min-w-0 flex-1 text-sm text-gray-800">
                      <span className="font-semibold mr-2">{item.assignee}</span>
                      {item.progress && <span className="text-gray-600">{item.progress}</span>}
                      {item.request && <div className="text-xs text-gray-500 mt-0.5">요청: {item.request}</div>}
                    </div>
                    <button onClick={() => startEditPart(item)} className="px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600">
                      수정
                    </button>
                    <button
                      onClick={async () => { try { await removePartItem(item.id); } catch (err) { alert(err.message); } }}
                      className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* 액션아이템 섹션 */}
          <section className="bg-white border rounded p-4">
            <h2 className="font-semibold text-gray-800 mb-3">액션아이템</h2>

            <div className="mb-4 p-3 border rounded bg-gray-50">
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="회의 원문을 붙여넣으면 AI가 액션아이템을 자동으로 추출합니다."
                rows={4}
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex items-center justify-between mt-2">
                {generateError ? (
                  <span className="text-xs text-red-500">{generateError}</span>
                ) : generating ? (
                  <span className="text-xs text-gray-500">원문 길이에 따라 최대 1~2분 정도 걸릴 수 있어요. 잠시만 기다려주세요.</span>
                ) : <span />}
                <button
                  onClick={submitGenerate}
                  disabled={generating || !notesText.trim()}
                  className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'AI 생성 중...' : 'AI로 자동생성'}
                </button>
              </div>
            </div>

            <form onSubmit={submitAction} className="grid grid-cols-1 md:grid-cols-[100px_minmax(0,1fr)_90px_100px_100px_72px] gap-2 mb-3">
              <input
                value={actionForm.task_type}
                onChange={(e) => setActionForm((prev) => ({ ...prev, task_type: e.target.value }))}
                placeholder="업무구분"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                value={actionForm.content}
                onChange={(e) => setActionForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="내용"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <select
                value={actionForm.status}
                onChange={(e) => setActionForm((prev) => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                value={actionForm.due_date}
                onChange={(e) => setActionForm((prev) => ({ ...prev, due_date: e.target.value }))}
                placeholder="기한"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                value={actionForm.assignee}
                onChange={(e) => setActionForm((prev) => ({ ...prev, assignee: e.target.value }))}
                placeholder="담당자"
                className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                추가
              </button>
            </form>

            <div className="space-y-2">
              {detail.action_items.map((item) => (
                editingActionId === item.id ? (
                  <div key={item.id} className="p-2 rounded border bg-blue-50 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input
                        value={actionEditForm.task_type}
                        onChange={(e) => setActionEditForm((prev) => ({ ...prev, task_type: e.target.value }))}
                        placeholder="업무구분"
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <input
                        value={actionEditForm.content}
                        onChange={(e) => setActionEditForm((prev) => ({ ...prev, content: e.target.value }))}
                        placeholder="내용"
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 md:col-span-2"
                      />
                      <select
                        value={actionEditForm.status}
                        onChange={(e) => setActionEditForm((prev) => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input
                        value={actionEditForm.due_date}
                        onChange={(e) => setActionEditForm((prev) => ({ ...prev, due_date: e.target.value }))}
                        placeholder="기한"
                        className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <input
                      value={actionEditForm.assignee}
                      onChange={(e) => setActionEditForm((prev) => ({ ...prev, assignee: e.target.value }))}
                      placeholder="담당자"
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEditAction} className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                        취소
                      </button>
                      <button
                        onClick={() => saveActionEdit(item.id)}
                        disabled={!actionEditForm.content.trim()}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="flex items-start gap-2 p-2 rounded border bg-gray-50">
                    <div className="min-w-0 flex-1 text-sm text-gray-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] rounded bg-white border text-gray-500">{item.task_type}</span>
                        <span className={
                          'px-2 py-0.5 text-[11px] rounded ' +
                          (item.status === '완료' ? 'bg-emerald-100 text-emerald-700'
                            : item.status === '진행중' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600')
                        }>
                          {item.status}
                        </span>
                        <span className="break-words">{item.content}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.due_date && <span className="mr-3">기한: {item.due_date}</span>}
                        {item.assignee && <span>담당: {item.assignee}</span>}
                      </div>
                    </div>
                    <button onClick={() => startEditAction(item)} className="px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600">
                      수정
                    </button>
                    <button
                      onClick={async () => { try { await removeActionItem(item.id); } catch (err) { alert(err.message); } }}
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
      )}

      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmState(null)}
        >
          <div className="w-full max-w-sm rounded border bg-white shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-800 mb-4">{confirmState.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmState(null)} className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                아니오
              </button>
              <button
                onClick={async () => {
                  const { onConfirm } = confirmState;
                  setConfirmState(null);
                  await onConfirm();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
