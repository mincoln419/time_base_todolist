import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useWarRoom } from '../../hooks/useWarRoom';
import MemberRoster from './MemberRoster';
import Rail from './Rail';

export default function WarRoomBoard() {
  const {
    rails, members, loaded,
    addRail, renameRail, moveRailUp, moveRailDown, removeRail,
    addMember, moveMember, removeMember,
    addMemberTask, setPrimaryTask, removeMemberTask,
  } = useWarRoom();
  const [railInput, setRailInput] = useState('');
  const [confirmState, setConfirmState] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = ({ active, over }) => {
    if (!over) return;
    const memberId = active.data.current?.memberId;
    if (memberId == null) return;

    const targetRailId = over.id === 'roster'
      ? null
      : (typeof over.id === 'string' && over.id.startsWith('rail-') ? Number(over.id.slice('rail-'.length)) : undefined);
    if (targetRailId === undefined) return;

    const member = members.find((m) => m.id === memberId);
    if (member && member.rail_id === targetRailId) return;

    moveMember(memberId, targetRailId);
  };

  const submitRail = (e) => {
    e.preventDefault();
    const v = railInput.trim();
    if (!v) return;
    addRail(v);
    setRailInput('');
  };

  const requestDeleteRail = (rail) => {
    setConfirmState({
      message: `"${rail.name}" 레일을 삭제할까요? 배치된 인원은 미배치 목록으로 돌아갑니다.`,
      onConfirm: () => removeRail(rail.id),
    });
  };

  const requestDeleteMember = (member) => {
    setConfirmState({
      message: `"${member.name}" 인원을 삭제할까요? 이 인원의 업무 태그도 함께 삭제됩니다.`,
      onConfirm: () => removeMember(member.id),
    });
  };

  if (!loaded) {
    return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
  }

  const unassigned = members.filter((m) => m.rail_id == null);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <MemberRoster
          members={unassigned}
          onAdd={addMember}
          onAddTask={addMemberTask}
          onSetPrimary={setPrimaryTask}
          onDeleteTask={removeMemberTask}
          onRequestDelete={requestDeleteMember}
        />

        {rails.map((rail, index) => (
          <Rail
            key={rail.id}
            rail={rail}
            members={members.filter((m) => m.rail_id === rail.id)}
            isFirst={index === 0}
            isLast={index === rails.length - 1}
            onRename={renameRail}
            onMoveUp={() => moveRailUp(rail.id)}
            onMoveDown={() => moveRailDown(rail.id)}
            onRequestDelete={requestDeleteRail}
            onAddTask={addMemberTask}
            onSetPrimary={setPrimaryTask}
            onDeleteTask={removeMemberTask}
            onRequestDeleteMember={requestDeleteMember}
          />
        ))}

        <div className="p-4">
          <form onSubmit={submitRail} className="flex gap-2">
            <input
              value={railInput}
              onChange={(e) => setRailInput(e.target.value)}
              placeholder="새 레일 이름 (업무/프로젝트)"
              className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button type="submit" className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
              + 레일 추가
            </button>
          </form>
        </div>
      </DndContext>

      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="w-full max-w-sm rounded border bg-white shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-800 mb-4">{confirmState.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmState(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
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
