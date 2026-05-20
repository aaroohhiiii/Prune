-- Table to track every price update for "This Week in AI Pricing" widget
CREATE TABLE IF NOT EXISTS pricing_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name VARCHAR NOT NULL,
  plan_name VARCHAR NOT NULL,
  old_price NUMERIC,
  new_price NUMERIC,
  detected_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Fast index for the widget query (last 7 days, desc)
CREATE INDEX IF NOT EXISTS idx_pricing_changes_detected_at
  ON pricing_changes(detected_at DESC);
