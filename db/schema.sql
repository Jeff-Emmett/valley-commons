-- Valley of the Commons Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Waitlist table (simple interest signups)
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    involvement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    subscribed BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_created ON waitlist(created_at);

-- Applications table (full event applications)
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending',  -- pending, reviewing, accepted, waitlisted, declined
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(255),

    -- Personal Information
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    pronouns VARCHAR(50),
    date_of_birth DATE,

    -- Professional Background
    occupation VARCHAR(255),
    organization VARCHAR(255),
    skills TEXT[],  -- Array of skills
    languages TEXT[],  -- Array of languages spoken
    website VARCHAR(500),
    social_links JSONB,  -- {twitter: "", linkedin: "", etc}

    -- Participation Details
    attendance_type VARCHAR(50),  -- full (4 weeks), partial
    arrival_date DATE,
    departure_date DATE,
    accommodation_preference VARCHAR(50),  -- tent, shared-room, private-room, offsite
    dietary_requirements TEXT[],  -- vegetarian, vegan, gluten-free, etc
    dietary_notes TEXT,

    -- Motivation & Contribution
    motivation TEXT NOT NULL,  -- Why do you want to join?
    contribution TEXT,  -- What will you contribute?
    projects TEXT,  -- Projects you'd like to work on
    workshops_offer TEXT,  -- Workshops you could facilitate

    -- Commons Experience
    commons_experience TEXT,  -- Experience with commons/cooperatives
    community_experience TEXT,  -- Previous community living experience
    governance_interest TEXT[],  -- Areas of interest: housing, production, decision-making, ownership

    -- Practical
    how_heard VARCHAR(255),  -- How did you hear about us?
    referral_name VARCHAR(255),  -- Who referred you?
    previous_events TEXT[],  -- Previous related events attended

    -- Emergency Contact
    emergency_name VARCHAR(255),
    emergency_phone VARCHAR(50),
    emergency_relationship VARCHAR(100),

    -- Agreements
    code_of_conduct_accepted BOOLEAN DEFAULT FALSE,
    privacy_policy_accepted BOOLEAN DEFAULT FALSE,
    photo_consent BOOLEAN DEFAULT FALSE,

    -- Financial
    scholarship_needed BOOLEAN DEFAULT FALSE,
    scholarship_reason TEXT,
    contribution_amount VARCHAR(50),  -- sliding scale selection

    -- Admin notes
    admin_notes TEXT,

    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'reviewing', 'accepted', 'waitlisted', 'declined'))
);

CREATE INDEX idx_applications_email ON applications(email);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_submitted ON applications(submitted_at);

-- Email log table (track all sent emails)
CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    email_type VARCHAR(100) NOT NULL,  -- application_confirmation, waitlist_welcome, status_update, etc
    subject VARCHAR(500),
    resend_id VARCHAR(255),  -- Resend API message ID
    status VARCHAR(50) DEFAULT 'sent',  -- sent, delivered, bounced, failed
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_email_log_recipient ON email_log(recipient_email);
CREATE INDEX idx_email_log_type ON email_log(email_type);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'reviewer',  -- admin, reviewer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Session tokens for admin auth
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
