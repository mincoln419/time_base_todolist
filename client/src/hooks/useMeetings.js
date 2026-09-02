import { useCallback, useEffect, useState } from 'react';
import {
  createActionItem,
  createMeeting,
  createOverallItem,
  createPartItem,
  deleteActionItem,
  deleteMeeting,
  deleteOverallItem,
  deletePartItem,
  fetchMeetingDetail,
  fetchMeetings,
  generateActionItems as generateActionItemsApi,
  updateActionItem,
  updateOverallItem,
  updatePartItem,
} from '../api/meetings';

export function useMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const loadMeetings = useCallback(async () => {
    const data = await fetchMeetings();
    setMeetings(data);
    setLoaded(true);
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const loadDetail = useCallback(async (id) => {
    const data = await fetchMeetingDetail(id);
    setDetail(data);
  }, []);

  const selectMeeting = useCallback(async (id) => {
    setSelectedId(id);
    setGenerateError(null);
    await loadDetail(id);
  }, [loadDetail]);

  const backToList = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setGenerateError(null);
  }, []);

  const reloadListAfter = useCallback(async (action) => {
    const result = await action();
    await loadMeetings();
    return result;
  }, [loadMeetings]);

  const reloadDetailAfter = useCallback(async (action) => {
    const result = await action();
    if (selectedId != null) await loadDetail(selectedId);
    return result;
  }, [selectedId, loadDetail]);

  const removeMeeting = useCallback(async (id) => {
    await reloadListAfter(() => deleteMeeting(id));
    if (selectedId === id) backToList();
  }, [reloadListAfter, selectedId, backToList]);

  const runGenerateActionItems = useCallback(async (meetingId, notes) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await reloadDetailAfter(() => generateActionItemsApi(meetingId, notes));
      return true;
    } catch (e) {
      setGenerateError(e.message);
      return false;
    } finally {
      setGenerating(false);
    }
  }, [reloadDetailAfter]);

  return {
    meetings,
    loaded,
    selectedId,
    detail,
    generating,
    generateError,
    selectMeeting,
    backToList,
    addMeeting: (payload) => reloadListAfter(() => createMeeting(payload)),
    removeMeeting,
    addOverallItem: (meetingId, payload) => reloadDetailAfter(() => createOverallItem(meetingId, payload)),
    updateOverallItem: (id, payload) => reloadDetailAfter(() => updateOverallItem(id, payload)),
    removeOverallItem: (id) => reloadDetailAfter(() => deleteOverallItem(id)),
    addPartItem: (meetingId, payload) => reloadDetailAfter(() => createPartItem(meetingId, payload)),
    updatePartItem: (id, payload) => reloadDetailAfter(() => updatePartItem(id, payload)),
    removePartItem: (id) => reloadDetailAfter(() => deletePartItem(id)),
    addActionItem: (meetingId, payload) => reloadDetailAfter(() => createActionItem(meetingId, payload)),
    updateActionItem: (id, payload) => reloadDetailAfter(() => updateActionItem(id, payload)),
    removeActionItem: (id) => reloadDetailAfter(() => deleteActionItem(id)),
    generateActionItems: runGenerateActionItems,
  };
}
