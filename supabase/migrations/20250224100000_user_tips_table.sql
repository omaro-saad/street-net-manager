-- Tips seen per user per page. Shown once on first login; never again for that user (any device).
-- Backend uses service_role; app calls GET/POST /api/auth/tips with JWT.

CREATE TABLE user_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, page_key)
);

CREATE INDEX idx_user_tips_account ON user_tips(account_id);

ALTER TABLE user_tips ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_tips IS 'Tracks which onboarding tips the user has seen (once per page, per account).';
