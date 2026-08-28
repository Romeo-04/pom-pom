-- Hatch API schema. Idempotent: safe to run on every deploy.
-- One table per module (docs/fe-be-task-assignment.md §6).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- identity + settings (BE-1, BE-5)
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         TEXT UNIQUE NOT NULL,
  token_hash        TEXT NOT NULL,
  tab_guard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_token_hash_idx ON users (token_hash);

-- tasks (BE-2)
CREATE TABLE IF NOT EXISTS tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  active     BOOLEAN NOT NULL DEFAULT FALSE,
  focused_ms BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks (user_id, created_at DESC);

-- focus ledger (BE-3). Append only. The unique constraint IS the idempotency guarantee:
-- a retry after a timeout hits it and the pet is not double-fed (spec §3.4).
CREATE TABLE IF NOT EXISTS focus_credits (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  body_hash       TEXT NOT NULL,
  started_at      BIGINT NOT NULL,
  ended_at        BIGINT NOT NULL,
  task_id         UUID,
  focused_ms      BIGINT NOT NULL,
  created_at      BIGINT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS focus_credits_user_idx ON focus_credits (user_id);
