-- Screening history table
CREATE TABLE IF NOT EXISTS screening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  is_eligible BOOLEAN NOT NULL,
  reason TEXT,
  weight DECIMAL(5,2),
  screened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_screening_history_donor ON screening_history(donor_id);
CREATE INDEX IF NOT EXISTS idx_screening_history_date ON screening_history(screened_at);
