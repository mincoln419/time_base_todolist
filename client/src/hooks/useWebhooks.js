import { useState, useEffect, useCallback } from 'react';
import { fetchWebhooks, createWebhook, updateWebhook, deleteWebhook } from '../api/webhooks';

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState([]);

  const load = useCallback(async () => {
    setWebhooks(await fetchWebhooks());
  }, []);

  useEffect(() => { load(); }, [load]);

  const addWebhook = useCallback(async (name, url) => {
    const webhook = await createWebhook({ name, url });
    setWebhooks((prev) => [...prev, webhook]);
  }, []);

  const toggleWebhook = useCallback(async (id, enabled) => {
    const webhook = await updateWebhook(id, { enabled });
    setWebhooks((prev) => prev.map((w) => (w.id === id ? webhook : w)));
  }, []);

  const removeWebhook = useCallback(async (id) => {
    await deleteWebhook(id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return { webhooks, addWebhook, toggleWebhook, removeWebhook };
}
