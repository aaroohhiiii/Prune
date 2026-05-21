-- Create the email tracking table
CREATE TABLE IF NOT EXISTS email_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id       VARCHAR(255) UNIQUE NOT NULL, -- Resend Email ID
  user_email       VARCHAR(255) NOT NULL,
  email_type       VARCHAR(50) NOT NULL,         -- 'audit_result', 'pricing_change', or 'reaudit'
  sent_at          TIMESTAMPTZ DEFAULT now(),
  opened_at        TIMESTAMPTZ DEFAULT NULL,
  clicked_at       TIMESTAMPTZ DEFAULT NULL,
  click_url        VARCHAR(2048) DEFAULT NULL,
  bounce_at        TIMESTAMPTZ DEFAULT NULL,
  unsubscribed_at   TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Optimize search operations on email events
CREATE INDEX IF NOT EXISTS idx_email_events_user_email ON email_events (user_email);
CREATE INDEX IF NOT EXISTS idx_email_events_sent_at_desc ON email_events (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_email_type ON email_events (email_type);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events (message_id);
