-- Some admins must never be e-mailed by the system (they get a hand-delivered link instead).
-- email_ok = 0: sign-in link requests for this address are held and logged, never sent.
ALTER TABLE admins ADD COLUMN email_ok INTEGER NOT NULL DEFAULT 1;
