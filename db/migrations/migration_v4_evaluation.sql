-- Migration V4: Evaluation and Scoring

-- 1. Add score column to kaizens table
ALTER TABLE kaizens 
ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 1 AND score <= 10);
