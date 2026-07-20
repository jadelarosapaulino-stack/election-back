DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'election'
  ) THEN
    FOR constraint_name IN
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'questions'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'election'
    LOOP
      EXECUTE format('ALTER TABLE questions DROP CONSTRAINT %I', constraint_name);
    END LOOP;

    ALTER TABLE questions RENAME COLUMN election TO "electionId";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'questions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'electionId'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT "FK_questions_electionId"
      FOREIGN KEY ("electionId")
      REFERENCES elections(id)
      ON DELETE CASCADE;
  END IF;
END $$;
