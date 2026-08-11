import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../api/backup';

export default function BackupControls() {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `todolist-backup-${backup.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 선택해도 change가 발생하도록 초기화
    if (!file) return;

    if (!window.confirm(
      '가져오기를 실행하면 이 기기의 모든 데이터(할일, 일정, 포커스 맵, 고객사, 티켓)가 선택한 파일 내용으로 완전히 교체됩니다. 계속할까요?'
    )) return;

    setBusy(true);
    try {
      const payload = JSON.parse(await file.text());
      const result = await importBackup(payload);
      const summary = Object.entries(result.imported).map(([k, v]) => `${k}: ${v}`).join(', ');
      alert(`가져오기 완료 (${summary})`);
      window.location.reload();
    } catch (e) {
      alert('가져오기 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={busy}
        className="px-3 py-1 text-sm font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
      >
        내보내기
      </button>
      <button
        onClick={handleImportClick}
        disabled={busy}
        className="px-3 py-1 text-sm font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
      >
        가져오기
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
