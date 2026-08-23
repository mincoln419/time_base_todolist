import { useCallback, useEffect, useState } from 'react';
import {
  createBucketItem,
  createLongGoal,
  createRequirement,
  createReward,
  createSubgoal,
  deleteBucketItem,
  deleteLongGoal,
  deleteRequirement,
  deleteReward,
  deleteSubgoal,
  fetchLongGoals,
  updateBucketItem,
  updateLongGoal,
  updateRequirement,
  updateSubgoal,
} from '../api/longgoals';

export function useLongGoals() {
  const [goals, setGoals] = useState([]);
  const [bucketItems, setBucketItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchLongGoals();
    setGoals(data.goals);
    setBucketItems(data.bucketItems);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reloadAfter = useCallback(async (action) => {
    const result = await action();
    await load();
    return result;
  }, [load]);

  return {
    goals,
    bucketItems,
    loaded,
    addGoal: (payload) => reloadAfter(() => createLongGoal(payload)),
    updateGoal: (id, payload) => reloadAfter(() => updateLongGoal(id, payload)),
    removeGoal: (id) => reloadAfter(() => deleteLongGoal(id)),
    addSubgoal: (goalId, payload) => reloadAfter(() => createSubgoal(goalId, payload)),
    updateSubgoal: (id, payload) => reloadAfter(() => updateSubgoal(id, payload)),
    removeSubgoal: (id) => reloadAfter(() => deleteSubgoal(id)),
    addRequirement: (goalId, payload) => reloadAfter(() => createRequirement(goalId, payload)),
    updateRequirement: (id, payload) => reloadAfter(() => updateRequirement(id, payload)),
    removeRequirement: (id) => reloadAfter(() => deleteRequirement(id)),
    addReward: (goalId, payload) => reloadAfter(() => createReward(goalId, payload)),
    removeReward: (id) => reloadAfter(() => deleteReward(id)),
    addBucketItem: (payload) => reloadAfter(() => createBucketItem(payload)),
    updateBucketItem: (id, payload) => reloadAfter(() => updateBucketItem(id, payload)),
    removeBucketItem: (id) => reloadAfter(() => deleteBucketItem(id)),
  };
}
