-- 할일 백로그 (템플릿 목록)
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 시간 블록 (백로그와 독립적인 일정 데이터)
CREATE TABLE IF NOT EXISTS schedules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  date       TEXT    NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour   INTEGER NOT NULL CHECK (end_hour > start_hour AND end_hour <= 24),
  status     TEXT    NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_progress', 'done', 'skipped')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (date, start_hour)
);

-- 포커스 맵(BJ Fogg 행동 설계) 세션 — 목표(goal)별로 여러 세션을 JSON으로 저장
-- Design Ref: §3.3 — goal을 UNIQUE 키로 사용, id는 URL 경로용 PK
CREATE TABLE IF NOT EXISTS focus_map (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  goal       TEXT    NOT NULL UNIQUE,
  data       TEXT    NOT NULL,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 고객사
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 고객사별 티켓 (registered: 0=등록 전, 1=등록됨, desired_date: 희망 일자, 선택)
CREATE TABLE IF NOT EXISTS tickets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  registered   INTEGER NOT NULL DEFAULT 0 CHECK (registered IN (0, 1)),
  desired_date TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
