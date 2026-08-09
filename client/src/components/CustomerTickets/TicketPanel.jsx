import { useState } from 'react';

export default function TicketPanel({ customer, tickets, onAdd, onToggle, onSetDesiredDate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [dateInput, setDateInput] = useState('');

  if (!customer) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <p className="text-sm text-gray-400">왼쪽에서 고객사를 선택해주세요.</p>
      </div>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) { setAdding(false); return; }
    onAdd(v, dateInput);
    setInput('');
    setDateInput('');
    setAdding(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-gray-700">{customer.name} 의 티켓</h2>
        <button
          onClick={() => setAdding(true)}
          className="w-7 h-7 flex items-center justify-center text-lg leading-none bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          +
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="flex gap-2 p-4 border-b bg-gray-50">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => { if (!input.trim()) setAdding(false); }}
            placeholder="티켓 제목 입력"
            className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            title="희망 일자 (선택)"
            className="px-2 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button type="submit" className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            추가
          </button>
        </form>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tickets.length === 0 && (
          <p className="p-4 text-xs text-gray-400">등록된 티켓이 없습니다.</p>
        )}
        {tickets.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 px-4 py-3 border-b group"
          >
            <span
              onClick={() => onToggle(t.id)}
              className={
                'text-sm cursor-pointer select-none flex-1 ' +
                (t.registered ? 'line-through text-gray-400' : 'text-gray-700')
              }
              title={t.registered ? '클릭하면 등록 전 상태로 되돌립니다' : '클릭하면 등록됨으로 표시합니다'}
            >
              {t.title}
            </span>
            <input
              type="date"
              value={t.desired_date || ''}
              onChange={(e) => onSetDesiredDate(t.id, e.target.value)}
              title="희망 일자"
              className="px-2 py-1 text-xs border rounded text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={() => onDelete(t.id)}
              className="text-xs text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
