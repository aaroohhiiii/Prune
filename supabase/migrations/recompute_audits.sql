-- Migration to add columns needed for the pricing change detection system

-- Add is_stale column to audits
ALTER TABLE audits ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT FALSE;

-- Add price_snapshot_id column to audits referencing pricing_snapshot
-- First check if pricing_snapshot table exists (it was created in pricing_snapshot.sql)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS price_snapshot_id UUID REFERENCES pricing_snapshot(id) ON DELETE SET NULL;

-- Create index for quick lookups on price_snapshot_id and is_stale
CREATE INDEX IF NOT EXISTS idx_audits_price_snapshot_id ON audits (price_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_audits_is_stale ON audits (is_stale) WHERE is_stale = TRUE;
