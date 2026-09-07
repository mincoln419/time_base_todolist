import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, createTask, deleteTask, touchTask } from '../api/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState([]);

  const load = useCallback(async () => {
    setTasks(await fetchTasks());
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTask = useCallback(async (title) => {
    const task = await createTask(title);
    // 새 할일은 아직 사용 전이라 서버 정렬(최근 사용순)상 항상 맨 뒤에 위치 — 목록 끝에 붙인다
    setTasks((prev) => [...prev, task]);
  }, []);

  const removeTask = useCallback(async (id) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 할일을 스케줄에 배치할 때 호출 — "최근 사용" 정렬이 바뀌므로 서버 정렬 결과를 다시 불러온다
  const markTaskUsed = useCallback(async (id) => {
    await touchTask(id);
    await load();
  }, [load]);

  return { tasks, addTask, removeTask, markTaskUsed };
}
