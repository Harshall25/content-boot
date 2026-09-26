-- Brings an existing database up to date. Additive only: nothing is dropped or rewritten.
-- Safe to run twice (IF NOT EXISTS everywhere).

-- due_date was added to schema.sql earlier but never applied to the live table.
ALTER TABLE content ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE TABLE IF NOT EXISTS app_user (
    access_key  VARCHAR(19) PRIMARY KEY,
    created_at  TIMESTAMP   NOT NULL DEFAULT now()
);

-- Nullable on purpose: rows created before access keys existed have no owner.
-- They stay in the table but no key can see them. Delete them whenever you like:
--   DELETE FROM content WHERE access_key IS NULL;
ALTER TABLE content ADD COLUMN IF NOT EXISTS access_key VARCHAR(19)
    REFERENCES app_user(access_key) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_access_key ON content(access_key);
