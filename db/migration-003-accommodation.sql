-- Migration 003: Add accommodation_type column to applications table
-- Stores the CCG-style accommodation selection (e.g. ch-multi, hh-single)
-- Keeps existing accommodation_preference column for backward compatibility

ALTER TABLE applications ADD COLUMN IF NOT EXISTS accommodation_type VARCHAR(50);
