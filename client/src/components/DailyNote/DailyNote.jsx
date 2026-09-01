import { useState } from 'react';
import { useDailyNotes } from '../../hooks/useDailyNotes';
import DailyNoteForm from './DailyNoteForm';
import DailyNoteList from './DailyNoteList';
import DailyNoteCalendarView from './DailyNoteCalendarView';
import DailyNoteMindMapView from './DailyNoteMindMapView';

const VIEWS = [
  { id: 'list', label: '목록' },
  { id: 'calendar', label: '캘린더' },
  { id: 'mindmap', label: '마인드맵' },
];

export default function DailyNote() {
  const { notes, loaded, addNote, editNote, removeNote } = useDailyNotes();
  const [view, setView] = useState('list');
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState(null);
  const [editingNote, setEditingNote] = useState(null);

  const openCreateForm = (defaultDate) => {
    setEditingNote(null);
    setFormDefaultDate(defaultDate ?? null);
    setFormOpen(true);
  };

  const openEditForm = (note) => {
    setEditingNote(note);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingNote(null);
  };

  const handleSubmit = async (draft) => {
    if (editingNote) {
      await editNote(editingNote.id, draft);
    } else {
      await addNote(draft);
    }
    closeForm();
  };

  if (!loaded) {
    return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto p-4 gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => openCreateForm()}
          className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-500 text-white hover:bg-blue-600"
        >
          + 새 아이디어 작성
        </button>
        <div className="flex gap-1 bg-gray-100 rounded p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={
                'px-3 py-1 text-xs font-semibold rounded ' +
                (view === v.id ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700')
              }
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {formOpen && (
        <DailyNoteForm
          initialNote={editingNote}
          defaultDate={formDefaultDate}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {view === 'list' && (
        <DailyNoteList notes={notes} onEdit={openEditForm} onDelete={removeNote} />
      )}
      {view === 'calendar' && (
        <DailyNoteCalendarView notes={notes} onCreateForDate={openCreateForm} onEdit={openEditForm} onDelete={removeNote} />
      )}
      {view === 'mindmap' && (
        <DailyNoteMindMapView notes={notes} onEdit={openEditForm} onDelete={removeNote} />
      )}
    </div>
  );
}
