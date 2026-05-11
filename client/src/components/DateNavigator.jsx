export default function DateNavigator({ date, onChange }) {
  const move = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white border-b">
      <button onClick={() => move(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">◀</button>
      <span className="text-lg font-semibold">{date}</span>
      <button onClick={() => move(1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">▶</button>
    </div>
  );
}
