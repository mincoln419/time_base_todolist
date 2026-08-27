import { useCallback, useEffect, useState } from 'react';
import {
  addMemberTask,
  createMember,
  createRail,
  deleteMember,
  deleteMemberTask,
  deleteRail,
  fetchBoard,
  moveMember,
  moveRail,
  renameRail,
  setPrimaryTask,
} from '../api/warroom';

export function useWarRoom() {
  const [rails, setRails] = useState([]);
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchBoard();
    setRails(data.rails);
    setMembers(data.members);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reloadAfter = useCallback(async (action) => {
    const result = await action();
    await load();
    return result;
  }, [load]);

  return {
    rails,
    members,
    loaded,
    addRail: (name) => reloadAfter(() => createRail({ name })),
    renameRail: (id, name) => reloadAfter(() => renameRail(id, { name })),
    moveRailUp: (id) => reloadAfter(() => moveRail(id, 'up')),
    moveRailDown: (id) => reloadAfter(() => moveRail(id, 'down')),
    removeRail: (id) => reloadAfter(() => deleteRail(id)),
    addMember: (name) => reloadAfter(() => createMember({ name })),
    moveMember: (id, railId) => reloadAfter(() => moveMember(id, railId)),
    removeMember: (id) => reloadAfter(() => deleteMember(id)),
    addMemberTask: (memberId, title) => reloadAfter(() => addMemberTask(memberId, { title })),
    setPrimaryTask: (taskId, isPrimary) => reloadAfter(() => setPrimaryTask(taskId, isPrimary)),
    removeMemberTask: (taskId) => reloadAfter(() => deleteMemberTask(taskId)),
  };
}
