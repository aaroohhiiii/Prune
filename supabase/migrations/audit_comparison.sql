-- ═══════════════════════════════════════════════════════════════
-- Audit Comparison Migration
-- Adds previous_audit_id column to link re-audits together
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Add the previous_audit_id column to audits table
ALTER TABLE audits ADD COLUMN IF NOT EXISTS previous_audit_id UUID REFERENCES audits(id);

-- Index for quick lookup of audit chains
CREATE INDEX IF NOT EXISTS idx_audits_previous ON audits (previous_audit_id) WHERE previous_audit_id IS NOT NULL;
