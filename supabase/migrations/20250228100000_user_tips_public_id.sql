-- Link user_tips to accounts by public_id (9-digit) for tips/page-tips flow.
-- Keeps account_id for referential integrity; lookups use public_id.

ALTER TABLE user_tips ADD COLUMN IF NOT EXISTS public_id INTEGER;

-- Backfill from accounts
UPDATE user_tips ut
SET public_id = a.public_id
FROM accounts a
WHERE ut.account_id = a.id AND ut.public_id IS NULL;

ALTER TABLE user_tips ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tips_public_page ON user_tips(public_id, page_key);
CREATE INDEX IF NOT EXISTS idx_user_tips_public_id ON user_tips(public_id);

COMMENT ON COLUMN user_tips.public_id IS 'Same as accounts.public_id; used for tips lookups by 9-digit id.';
