-- Full schema for a FRESH database (Neon SQL editor or psql).
-- For the database you already have, run db/migration-002-access-keys.sql instead.

-- "user" is a reserved word in PostgreSQL, hence app_user.
-- The access key IS the user's identity: shown top-right in the app,
-- typed back in to reopen the board.
CREATE TABLE IF NOT EXISTS app_user (
    access_key  VARCHAR(19) PRIMARY KEY,          -- e.g. 7KQM-3XPA-HN2W-9RTC
    created_at  TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    status        VARCHAR(20),
    content_type  VARCHAR(20),
    date_created  TIMESTAMP,
    date_updated  TIMESTAMP,
    due_date      DATE,
    url           VARCHAR(500),
    access_key    VARCHAR(19) REFERENCES app_user(access_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_access_key ON content(access_key);
