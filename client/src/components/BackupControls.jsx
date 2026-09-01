import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../api/backup';

const TYPE_LABELS = {
  full: '전체',
  schedule: '일정관리',
  focusmap: '포커스 맵',
  customers: '고객사 티켓',
  calendar: '캘린더',
  worries: '무의식 고민목록',
  longgoals: '장기목표',
  warroom: '업무 배치 보드',
  dailynote: '데일리노트',
};

function fileSafeLabel(label) {
  return label.replace(/\s+/g, '-');
}

export default function BackupControls({ scope = { id: 'full', label: '전체' } }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup(scope.id);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileSafeLabel(backup.label || scope.label)}-backup-${backup.exportedAt.slice(0, 10)}.json`;
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

    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (err) {
      alert('가져오기 실패: 올바른 JSON 파일이 아닙니다.');
      return;
    }

    const type = payload.type || 'full';
    const label = payload.label || TYPE_LABELS[type] || '전체';
    if (!window.confirm(
      `가져오기를 실행하면 이 기기의 ${label} 데이터만 선택한 파일 내용으로 교체됩니다. 계속할까요?`
    )) return;

    setBusy(true);
    try {
      const result = await importBackup(payload);
      const summary = Object.entries(result.imported).map(([k, v]) => `${k}: ${v}`).join(', ');
      alert(`${result.label || label} 가져오기 완료 (${summary})`);
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
        {scope.label} 내보내기
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
