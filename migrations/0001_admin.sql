-- Admins (allow-list), their passkeys, sign-in links, sessions and an audit trail.
-- Times are Unix seconds. Tokens are stored only as SHA-256 hashes.
CREATE TABLE admins (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_handle TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_sign_in_at INTEGER
);
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT NOT NULL DEFAULT '[]',
  device_type TEXT,
  backed_up INTEGER,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX passkeys_email ON passkeys(email);
CREATE TABLE login_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX login_links_email ON login_links(email, created_at);
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  challenge TEXT NOT NULL,
  email TEXT,
  expires_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('link', 'passkey')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  email TEXT,
  action TEXT NOT NULL,
  detail TEXT
);
