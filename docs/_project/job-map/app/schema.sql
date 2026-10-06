-- Postgres: users and what they do with jobs. Job data itself lives in jobs.sqlite (read-only).
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));

-- A saved job keeps a copy of the fields to show, because the role can disappear from the crawl.
CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_url    TEXT   NOT NULL,
  title      TEXT   NOT NULL,
  company    TEXT   NOT NULL,
  location   TEXT   NOT NULL DEFAULT '',
  country    TEXT   NOT NULL DEFAULT 'OTHER',
  status     TEXT   NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','applied','interview','offer','rejected')),
  notes      TEXT   NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_url)
);
CREATE INDEX IF NOT EXISTS saved_jobs_user_status ON saved_jobs (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT   NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  filters    JSONB  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_searches_user ON saved_searches (user_id);
