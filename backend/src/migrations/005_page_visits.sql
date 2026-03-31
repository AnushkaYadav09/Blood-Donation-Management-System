-- Page visits tracking table
CREATE TABLE IF NOT EXISTS page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path VARCHAR(500) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  donor_id UUID REFERENCES donors(id) ON DELETE SET NULL,
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_visits_path ON page_visits(path);
CREATE INDEX IF NOT EXISTS idx_page_visits_visited_at ON page_visits(visited_at);
