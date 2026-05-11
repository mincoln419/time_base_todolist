const CYCLE = ['planned', 'in_progress', 'done', 'skipped'];
const LABELS = { planned: '예정', in_progress: '진행중', done: '완료', skipped: '건너뜀' };
const COLORS = {
  planned:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  done:        'bg-green-100 text-green-700',
  skipped:     'bg-red-100 text-red-500',
};

export default function StatusBadge({ status, onChange }) {
  const next = () => onChange(CYCLE[(CYCLE.indexOf(status) + 1) % CYCLE.length]);

  return (
    <button
      onClick={next}
      className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[status]} hover:opacity-80`}
    >
      {LABELS[status]}
    </button>
  );
}
