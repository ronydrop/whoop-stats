CREATE TABLE IF NOT EXISTS sync_status (
 user_id UUID NOT NULL REFERENCES users(id), resource TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN ('running', 'success', 'error', 'interrupted')),
 started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ, last_success_at TIMESTAMPTZ,
 error_message TEXT, PRIMARY KEY (user_id, resource)
);
