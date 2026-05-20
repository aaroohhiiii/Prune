CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR NOT NULL UNIQUE,
  opted_in_reaudit_emails BOOLEAN DEFAULT TRUE,
  opted_in_audit_results BOOLEAN DEFAULT TRUE,
  opted_in_marketing BOOLEAN DEFAULT FALSE,
  unsubscribed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_email ON email_preferences(user_email);
