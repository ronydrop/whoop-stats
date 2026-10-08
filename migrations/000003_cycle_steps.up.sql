ALTER TABLE cycles ADD COLUMN IF NOT EXISTS step_count INTEGER CHECK (step_count >= 0);
