-- Unique 9-digit ID per account (100000000–999999999). Used for tips, author display, etc.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS public_id INTEGER UNIQUE;

-- Backfill existing rows with unique 9-digit ids (sequential from 100000001)
WITH ord AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM accounts
  WHERE public_id IS NULL
)
UPDATE accounts a
SET public_id = 100000000 + ord.rn
FROM ord
WHERE a.id = ord.id;

ALTER TABLE accounts ALTER COLUMN public_id SET NOT NULL;

-- Index for lookups by public_id (e.g. tips / author)
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_public_id ON accounts(public_id);

COMMENT ON COLUMN accounts.public_id IS 'Unique 9-digit integer ID for the user; used for tips, author, and external reference. Never reuse.';
