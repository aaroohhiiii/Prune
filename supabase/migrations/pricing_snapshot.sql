-- Create pricing_snapshot table
CREATE TABLE IF NOT EXISTS pricing_snapshot (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_name                 VARCHAR(100) NOT NULL,
  plan_name                 VARCHAR(100) NOT NULL,
  price_per_month           NUMERIC(10, 2) NOT NULL,
  min_seats                 INTEGER DEFAULT NULL,
  annual_discount_percent   INTEGER DEFAULT 0,
  features                  JSONB DEFAULT '[]'::jsonb,
  created_at                TIMESTAMPTZ DEFAULT now(),
  is_active                 BOOLEAN DEFAULT true,
  source_url                VARCHAR(255) NOT NULL,
  verified_date             DATE NOT NULL
);

-- Index to optimize pricing lookups
CREATE INDEX IF NOT EXISTS idx_pricing_snapshot_tool_plan ON pricing_snapshot (LOWER(tool_name), LOWER(plan_name), is_active);

-- Populate table with initial verified pricing from lib/pricingData.ts
INSERT INTO pricing_snapshot (tool_name, plan_name, price_per_month, min_seats, source_url, verified_date) VALUES
-- Cursor
('cursor', 'Hobby', 0.00, NULL, 'https://cursor.com/pricing', '2026-05-09'),
('cursor', 'Pro', 20.00, NULL, 'https://cursor.com/pricing', '2026-05-09'),
('cursor', 'Business', 40.00, 2, 'https://cursor.com/pricing', '2026-05-09'),
('cursor', 'Enterprise', 0.00, NULL, 'https://cursor.com/pricing', '2026-05-09'),

-- GitHub Copilot
('github-copilot', 'Free', 0.00, NULL, 'https://github.com/features/copilot/plans', '2026-05-09'),
('github-copilot', 'Individual', 10.00, NULL, 'https://github.com/features/copilot/plans', '2026-05-09'),
('github-copilot', 'Business', 19.00, 2, 'https://github.com/features/copilot/plans', '2026-05-09'),
('github-copilot', 'Enterprise', 39.00, 2, 'https://github.com/features/copilot/plans', '2026-05-09'),

-- Claude
('claude', 'Free', 0.00, NULL, 'https://claude.ai/pricing', '2026-05-09'),
('claude', 'Pro', 17.00, NULL, 'https://claude.ai/pricing', '2026-05-09'),
('claude', 'Max', 100.00, NULL, 'https://claude.ai/pricing', '2026-05-09'),
('claude', 'Team', 20.00, 2, 'https://claude.ai/pricing', '2026-05-09'),
('claude', 'Enterprise', 0.00, NULL, 'https://claude.ai/pricing', '2026-05-09'),

-- ChatGPT
('chatgpt', 'Free', 0.00, NULL, 'https://openai.com/chatgpt/pricing', '2026-05-09'),
('chatgpt', 'Plus', 21.17, NULL, 'https://openai.com/chatgpt/pricing', '2026-05-09'),
('chatgpt', 'Pro', 200.00, NULL, 'https://openai.com/chatgpt/pricing', '2026-05-09'),
('chatgpt', 'Team', 19.60, 2, 'https://openai.com/chatgpt/pricing', '2026-05-09'),
('chatgpt', 'Enterprise', 0.00, NULL, 'https://openai.com/chatgpt/pricing', '2026-05-09'),

-- Anthropic API
('anthropic-api', 'Usage-based', 0.00, NULL, 'https://www.anthropic.com/pricing#api', '2026-05-09'),

-- OpenAI API
('openai-api', 'Usage-based', 0.00, NULL, 'https://openai.com/api/pricing', '2026-05-09'),

-- Gemini
('gemini', 'Free', 0.00, NULL, 'https://gemini.google/subscriptions', '2026-05-09'),
('gemini', 'Pro', 19.99, NULL, 'https://gemini.google/subscriptions', '2026-05-09'),
('gemini', 'Ultra', 249.99, NULL, 'https://gemini.google/subscriptions', '2026-05-09'),
('gemini', 'API', 0.00, NULL, 'https://ai.google.dev/pricing', '2026-05-09'),

-- Windsurf
('windsurf', 'Free', 0.00, NULL, 'https://windsurf.com/pricing', '2026-05-09'),
('windsurf', 'Pro', 20.00, NULL, 'https://windsurf.com/pricing', '2026-05-09'),
('windsurf', 'Teams', 40.00, 2, 'https://windsurf.com/pricing', '2026-05-09'),
('windsurf', 'Enterprise', 0.00, NULL, 'https://windsurf.com/pricing', '2026-05-09')
ON CONFLICT DO NOTHING;
