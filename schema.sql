CREATE TABLE users (
  telegram_id   INTEGER PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  balance       INTEGER NOT NULL DEFAULT 0,
  earned_total  INTEGER NOT NULL DEFAULT 0,
  tasks_done    INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  last_checkin  TEXT,
  banned        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE checkins (
  telegram_id INTEGER NOT NULL,
  day         TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  PRIMARY KEY (telegram_id, day)
);

CREATE TABLE offers (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  payout_ngn   INTEGER NOT NULL,
  url_template TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE clicks (
  sub_id      TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  offer_id    TEXT NOT NULL,
  payout_ngn  INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  txid        TEXT UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  credited_at TEXT
);
CREATE INDEX idx_clicks_user ON clicks(telegram_id, status);

CREATE TABLE ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  ref         TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ledger_owner ON ledger(owner_id, id DESC);

CREATE TABLE referrals (
  referrer_id INTEGER NOT NULL,
  referee_id  INTEGER PRIMARY KEY,
  activated   INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_refs_referrer ON referrals(referrer_id, activated);

CREATE TABLE wallets (
  telegram_id INTEGER PRIMARY KEY,
  bank_name   TEXT,
  acct_num    TEXT,
  acct_name   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE payouts (
  id          TEXT PRIMARY KEY,
  owner_id    INTEGER NOT NULL,
  amount_ngn  INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'requested',
  cycle_date  TEXT,
  referrer_id INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT,
  rejected_at TEXT
);
CREATE INDEX idx_payouts_status ON payouts(status, created_at);
CREATE INDEX idx_payouts_ref ON payouts(referrer_id, cycle_date);

CREATE TABLE cycle_settlements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  beneficiary_id INTEGER NOT NULL,
  cycle_date     TEXT NOT NULL,
  referral_count INTEGER NOT NULL,
  amount_ngn     INTEGER NOT NULL,
  settled_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(beneficiary_id, cycle_date)
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE message_reads (
  message_id TEXT NOT NULL,
  reader_id  INTEGER NOT NULL,
  read_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, reader_id)
);

CREATE TABLE postback_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  query      TEXT,
  ip         TEXT,
  status     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
