-- 할일 백로그
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 시간 블록 (날짜 + 시간에 배치된 할일)
CREATE TABLE IF NOT EXISTS schedules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour   INTEGER NOT NULL CHECK (end_hour > start_hour AND end_hour <= 24),
  status     TEXT    NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_progress', 'done', 'skipped')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (date, start_hour)
);
