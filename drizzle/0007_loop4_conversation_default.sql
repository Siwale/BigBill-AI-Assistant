-- Loop 4: stop seeding the "New conversation" placeholder at the DB level.
-- Existing rows are preserved (no data rewrite); only the column default changes.
ALTER TABLE "conversations" ALTER COLUMN "title" SET DEFAULT 'Conversation';
