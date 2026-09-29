import { useCallback, useEffect, useState } from 'react';
import {
  createBook,
  createReadingNote,
  deleteBook,
  deleteLog,
  fetchBooks,
  fetchReadingSettings,
  putLog,
  saveReadingSettings,
  updateBook,
} from '../api/reading';

export function useReading() {
  const [books, setBooks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchBooks();
    setBooks(data.books);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    fetchReadingSettings().then(setSettings);
  }, [load]);

  const reloadAfter = useCallback(async (action) => {
    const result = await action();
    await load();
    return result;
  }, [load]);

  return {
    books,
    settings,
    loaded,
    saveSettings: async (payload) => setSettings(await saveReadingSettings(payload)),
    addBook: (payload) => reloadAfter(() => createBook(payload)),
    updateBook: (id, payload) => reloadAfter(() => updateBook(id, payload)),
    removeBook: (id) => reloadAfter(() => deleteBook(id)),
    checkLog: (bookId, date, pageTo) => reloadAfter(() => putLog(bookId, date, pageTo)),
    uncheckLog: (bookId, date) => reloadAfter(() => deleteLog(bookId, date)),
    addNote: (bookId, payload) => reloadAfter(() => createReadingNote(bookId, payload)),
  };
}
