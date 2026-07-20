-- H-03: Make vote.voterId nullable and change FK behavior to SET NULL
-- Existing votes retain their voterId; new anonymous votes will have NULL.

ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS "FK_votes_voter";

ALTER TABLE votes
  ALTER COLUMN "voterId" DROP NOT NULL;

ALTER TABLE votes
  ADD CONSTRAINT "FK_votes_voter"
    FOREIGN KEY ("voterId") REFERENCES voters(id)
    ON DELETE SET NULL;
