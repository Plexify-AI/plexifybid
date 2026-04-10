-- Migration: Add preferences JSONB column to tenants table
-- Stores per-tenant settings: email_signature, default_closing, include_closing, price_list
-- RLS already enforced on tenants table — service-role has full access, no new policies needed.
-- 2026-04-10

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

COMMENT ON COLUMN tenants.preferences IS 'Per-tenant preferences: email_signature (HTML), default_closing (text), include_closing (bool), price_list (array of product objects)';
