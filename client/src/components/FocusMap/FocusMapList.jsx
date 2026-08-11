const STEP_LABELS = ['행동 모으기', '1판 · 영향력', '2판 · 능력', '겹쳐 보기'];

// Design Ref: §5.3 — 좌측 목표 리스트, 순수 표시 컴포넌트 (훅 직접 호출 없음)
export default function FocusMapList({ list, activeId, loaded, error, onSelect, onDelete, onCreateNew }) {
  return (
    <div className="w-56 flex-shrink-0 border-r bg-white p-3 overflow-y-auto">
      <button
        onClick={onCreateNew}
        className="w-full px-3 py-2 text-sm font-semibold bg-blue-500 text-white rounded hover:bg-blue-600 mb-3"
      >
        + 새 목표 시작
      </button>

      {error && <div className="text-xs text-red-500 px-1 mb-2">{error}</div>}

      {!loaded ? (
        <div className="text-xs text-gray-400 px-1">불러오는 중...</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-gray-400 px-1 py-2">아직 저장된 목표가 없습니다.</div>
      ) : (
        <ul className="space-y-1">
          {list.map((fm) => (
            <li
              key={fm.id}
              className={
                'group rounded px-2 py-2 cursor-pointer border ' +
                (fm.id === activeId ? 'bg-blue-50 border-blue-300' : 'border-transparent hover:bg-gray-50')
              }
              onClick={() => onSelect(fm.id)}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-sm font-medium text-gray-800 truncate">{fm.goal}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(fm.id); }}
                  aria-label="삭제"
                  className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0"
                >
                  삭제
                </button>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{fm.updatedAt?.slice(0, 16)}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600">{STEP_LABELS[fm.step]}</span>
                {fm.goldCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">황금 {fm.goldCount}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
