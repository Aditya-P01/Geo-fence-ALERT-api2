-- Migration 003: Add owner fields to geo_fences
ALTER TABLE geo_fences
  ADD COLUMN IF NOT EXISTS owner_id   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_geo_fences_owner_id
  ON geo_fences (owner_id);
