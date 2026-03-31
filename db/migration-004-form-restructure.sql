-- Migration 004: Form restructure — add columns for new application flow
-- selected_weeks, top_themes, belief_update, volunteer_interest, coupon_code, food_preference, accessibility_needs

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS selected_weeks TEXT[],
  ADD COLUMN IF NOT EXISTS top_themes TEXT[],
  ADD COLUMN IF NOT EXISTS belief_update TEXT,
  ADD COLUMN IF NOT EXISTS volunteer_interest BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS food_preference TEXT,
  ADD COLUMN IF NOT EXISTS accessibility_needs TEXT;
