const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/todo.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// WAL 모드 + 외래키 활성화
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Design Ref: §3.3 — focus_map 단일 세션(id=1) 구조를 goal 다중 세션 구조로 1회 이관.
// 매 재시작마다 DROP되지 않도록, goal 컬럼이 없는 구버전 테이블일 때만 제거한다.
const focusMapCols = db.prepare("PRAGMA table_info(focus_map)").all();
const isLegacyFocusMap = focusMapCols.length > 0 && !focusMapCols.some((c) => c.name === 'goal');
if (isLegacyFocusMap) {
  db.exec('DROP TABLE focus_map');
}

// 마이그레이션: schedules가 구버전(start_hour/end_hour) 구조면 분 단위(start_min/end_min)로 이관
const scheduleColumns = db.prepare("PRAGMA table_info(schedules)").all();
const isLegacySchedules = scheduleColumns.some((c) => c.name === 'start_hour');
if (isLegacySchedules) {
  db.exec('ALTER TABLE schedules RENAME TO schedules_old');
}

// DDL 초기화
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

if (isLegacySchedules) {
  db.exec(`
    INSERT INTO schedules (id, title, date, start_min, end_min, status, created_at)
    SELECT id, title, date, start_hour * 60, end_hour * 60, status, created_at FROM schedules_old
  `);
  db.exec('DROP TABLE schedules_old');
}

// 마이그레이션: 기존 DB에 tickets.desired_date 컬럼이 없으면 추가
const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all();
if (!ticketColumns.some((c) => c.name === 'desired_date')) {
  db.exec('ALTER TABLE tickets ADD COLUMN desired_date TEXT');
}

module.exports = db;
