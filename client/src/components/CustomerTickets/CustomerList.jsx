import { useState } from 'react';

export default function CustomerList({ customers, selectedId, onSelect, onAdd, onDelete }) {
  const [input, setInput] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!window.confirm('고객사를 삭제하면 등록된 티켓도 함께 삭제됩니다. 삭제할까요?')) return;
    onDelete(id);
  };

  return (
    <div className="w-64 flex-shrink-0 flex flex-col border-r bg-white min-h-0">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-gray-700 mb-3">고객사</h2>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="고객사명 입력"
            className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button type="submit" className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            추가
          </button>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {customers.length === 0 && (
          <p className="p-4 text-xs text-gray-400">등록된 고객사가 없습니다.</p>
        )}
        {customers.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={
              'flex items-center justify-between px-4 py-3 border-b cursor-pointer transition-colors ' +
              (c.id === selectedId ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent')
            }
          >
            <span className={'text-sm ' + (c.id === selectedId ? 'font-semibold text-blue-700' : 'text-gray-700')}>
              {c.name}
            </span>
            <button
              onClick={(e) => handleDelete(e, c.id)}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
