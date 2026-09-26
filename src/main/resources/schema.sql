-- Run this once against your Neon database (Neon SQL editor or psql).
-- Matches the Content record and ContentEntity.
CREATE TABLE IF NOT EXISTS content (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    status        VARCHAR(20),
    content_type  VARCHAR(20),
    date_created  TIMESTAMP,
    date_updated  TIMESTAMP,
    url           VARCHAR(500)
);
