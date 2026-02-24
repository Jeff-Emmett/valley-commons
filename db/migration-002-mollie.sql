-- Migration 002: Add Mollie payment fields to applications table
-- Run this against existing databases to add payment support

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS mollie_payment_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_applications_mollie_id ON applications(mollie_payment_id);
CREATE INDEX IF NOT EXISTS idx_applications_payment_status ON applications(payment_status);
