import { useState } from 'react';
import { useWebhooks } from '../../hooks/useWebhooks';

export default function WebhookSettings() {
  const { webhooks, addWebhook, toggleWebhook, removeWebhook } = useWebhooks();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setBusy(true);
    try {
      await addWebhook(name.trim(), url.trim());
      setName('');
      setUrl('');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="font-semibold text-gray-700 mb-1">알림 웹훅 설정</h2>
      <p className="text-sm text-gray-400 mb-4">
        일정이 자동으로 '진행중'으로 전환될 때, 여기에 등록된 활성 웹훅으로 알림을 전송합니다.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          placeholder="이름 (예: Teams 알림)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 text-sm border rounded flex-shrink-0 sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <input
          type="text"
          placeholder="웹훅 URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="px-3 py-2 text-sm border rounded flex-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          type="submit"
          disabled={busy || !name.trim() || !url.trim()}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          + 등록
        </button>
      </form>

      <div className="space-y-2">
        {webhooks.length === 0 && (
          <p className="text-sm text-gray-400">등록된 웹훅이 없습니다.</p>
        )}
        {webhooks.map((w) => (
          <div key={w.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{w.name}</p>
              <p className="text-xs text-gray-400 truncate">{w.url}</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
              <input
                type="checkbox"
                checked={!!w.enabled}
                onChange={(e) => toggleWebhook(w.id, e.target.checked)}
              />
              활성
            </label>
            <button
              onClick={() => removeWebhook(w.id)}
              className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
