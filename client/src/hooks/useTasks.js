import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, createTask, deleteTask } from '../api/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState([]);

  const load = useCallback(async () => {
    setTasks(await fetchTasks());
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTask = useCallback(async (title) => {
    const task = await createTask(title);
    setTasks((prev) => [...prev, task]);
  }, []);

  const removeTask = useCallback(async (id) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, addTask, removeTask };
}
