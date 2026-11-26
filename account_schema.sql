CREATE SCHEMA IF NOT EXISTS productivity;
SET LOCAL search_path TO productivity, pg_catalog;

CREATE TABLE IF NOT EXISTS accounts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash bytea PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours')
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiration ON sessions (expires_at);

CREATE OR REPLACE FUNCTION active_user_id() RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('productivity.user_id', true), '')::bigint
$$;

CREATE TABLE IF NOT EXISTS entries (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL DEFAULT active_user_id() REFERENCES accounts (id) ON DELETE CASCADE,
    content text NOT NULL,
    mood text NOT NULL,
    tags text NOT NULL,
    created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS entries_owner ON entries (owner_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS entries_owner_id ON entries (owner_id, id);

CREATE TABLE IF NOT EXISTS tasks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL DEFAULT active_user_id() REFERENCES accounts (id) ON DELETE CASCADE,
    text text NOT NULL,
    priority text NOT NULL,
    due_date text,
    cadence text NOT NULL,
    month_day integer,
    completed integer NOT NULL DEFAULT 0,
    next_task_id bigint,
    created_at text NOT NULL,
    UNIQUE (owner_id, id),
    FOREIGN KEY (owner_id, next_task_id) REFERENCES tasks (owner_id, id) ON DELETE SET NULL (next_task_id)
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_entry_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = 'tasks'::regclass AND conname = 'tasks_source_entry') THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_source_entry
            FOREIGN KEY (owner_id, source_entry_id) REFERENCES entries (owner_id, id) ON DELETE SET NULL (source_entry_id);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS subtasks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL DEFAULT active_user_id() REFERENCES accounts (id) ON DELETE CASCADE,
    task_id bigint NOT NULL,
    text text NOT NULL,
    completed integer NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id, task_id) REFERENCES tasks (owner_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS subtasks_owner_task ON subtasks (owner_id, task_id);

CREATE TABLE IF NOT EXISTS preferences (
    owner_id bigint NOT NULL DEFAULT active_user_id() REFERENCES accounts (id) ON DELETE CASCADE,
    name text NOT NULL,
    value text NOT NULL,
    PRIMARY KEY (owner_id, name)
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL DEFAULT active_user_id() REFERENCES accounts (id) ON DELETE CASCADE,
    title text NOT NULL,
    start_day text NOT NULL,
    end_day text NOT NULL,
    start_time text,
    end_time text,
    notes text NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_deletions (
    owner_id bigint NOT NULL DEFAULT active_user_id() REFERENCES accounts (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('entries', 'tasks', 'subtasks', 'calendar_events')),
    record_id bigint NOT NULL,
    token text NOT NULL UNIQUE,
    expires text NOT NULL,
    PRIMARY KEY (owner_id, kind, record_id)
);

DO $$
DECLARE
    relation text;
BEGIN
    FOREACH relation IN ARRAY ARRAY['entries', 'tasks', 'subtasks', 'preferences', 'calendar_events', 'pending_deletions'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', relation);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', relation);
        IF NOT EXISTS (
            SELECT FROM pg_policies
            WHERE schemaname = 'productivity' AND tablename = relation AND policyname = 'account_owner'
        ) THEN
            EXECUTE format(
                'CREATE POLICY account_owner ON %I USING (owner_id = active_user_id()) WITH CHECK (owner_id = active_user_id())',
                relation
            );
        END IF;
    END LOOP;
END
$$;
