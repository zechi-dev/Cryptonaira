-- FULL SCHEMA for a NEW, EMPTY database only.
-- Matches everything worker.js reads and writes (including the network columns and decimal amounts).
-- Do NOT use this on your live database. Use migration.sql there.

CREATE TABLE IF NOT EXISTS users (
  telegram_id   INTEGER PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  balance       REAL NOT NULL DEFAULT 0,
  earned_total  REAL NOT NULL DEFAULT 0,
  tasks_done    INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  last_checkin  TEXT,
  banned        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checkins (
  telegram_id INTEGER NOT NULL,
  day         TEXT NOT NULL,
  amount      REAL NOT NULL,
  PRIMARY KEY (telegram_id, day)
);

CREATE TABLE IF NOT EXISTS offers (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  payout_ngn   REAL NOT NULL,
  url_template TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  sub_id      TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  offer_id    TEXT NOT NULL,
  payout_ngn  REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  txid        TEXT UNIQUE,
  network     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  credited_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON clicks(telegram_id, status);

CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL,
  delta       REAL NOT NULL,
  reason      TEXT NOT NULL,
  ref         TEXT,
  network     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_owner ON ledger(owner_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger(ref, network);

CREATE TABLE IF NOT EXISTS referrals (
  referrer_id  INTEGER NOT NULL,
  referee_id   INTEGER PRIMARY KEY,
  activated    INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refs_referrer ON referrals(referrer_id, activated);

CREATE TABLE IF NOT EXISTS wallets (
  telegram_id INTEGER PRIMARY KEY,
  bank_name   TEXT,
  acct_num    TEXT,
  acct_name   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts (
  id          TEXT PRIMARY KEY,
  owner_id    INTEGER NOT NULL,
  amount_ngn  REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'requested',
  cycle_date  TEXT,
  referrer_id INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT,
  rejected_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_ref ON payouts(referrer_id, cycle_date);

CREATE TABLE IF NOT EXISTS cycle_settlements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  beneficiary_id INTEGER NOT NULL,
  cycle_date     TEXT NOT NULL,
  referral_count INTEGER NOT NULL,
  amount_ngn     REAL NOT NULL,
  settled_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(beneficiary_id, cycle_date)
);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id TEXT NOT NULL,
  reader_id  INTEGER NOT NULL,
  read_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, reader_id)
);

CREATE TABLE IF NOT EXISTS postback_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  query      TEXT,
  ip         TEXT,
  status     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
