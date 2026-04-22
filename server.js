const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// API routes - wrap Vercel serverless functions
const waitlistHandler = require('./api/waitlist-db');
const newsletterHandler = require('./api/newsletter');
const applicationHandler = require('./api/application');
const applicationLookupHandler = require('./api/application').lookup;
const applicationSponsorHandler = require('./api/application').sponsor;
const gameChatHandler = require('./api/game-chat');
const shareToGithubHandler = require('./api/share-to-github');
const { handleWebhook, getPaymentStatus, resumePayment } = require('./api/mollie');

// Adapter to convert Vercel handler to Express
const vercelToExpress = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

app.all('/api/waitlist', vercelToExpress(waitlistHandler));
app.all('/api/newsletter', vercelToExpress(newsletterHandler));
app.all('/api/application', vercelToExpress(applicationHandler));
app.get('/api/application/lookup', vercelToExpress(applicationLookupHandler));
app.post('/api/application/sponsor', vercelToExpress(applicationSponsorHandler));
app.all('/api/game-chat', vercelToExpress(gameChatHandler));
app.all('/api/share-to-github', vercelToExpress(shareToGithubHandler));
app.post('/api/mollie/webhook', vercelToExpress(handleWebhook));
app.all('/api/mollie/status', vercelToExpress(getPaymentStatus));
app.get('/api/mollie/resume', vercelToExpress(resumePayment));

// Accommodation availability check
const { checkAvailability } = require('./api/booking-sheet');
const VALID_WEEKS = new Set(['week1', 'week2', 'week3', 'week4']);
app.get('/api/accommodation-availability', async (req, res) => {
  try {
    const weeksParam = (req.query.weeks || '').trim();
    if (!weeksParam) {
      return res.status(400).json({ error: 'weeks parameter required (e.g. week1,week2)' });
    }
    const selectedWeeks = weeksParam.split(',').filter(w => VALID_WEEKS.has(w));
    if (selectedWeeks.length === 0) {
      return res.status(400).json({ error: 'No valid weeks provided' });
    }
    const availability = await checkAvailability(selectedWeeks);
    if (!availability) {
      return res.status(503).json({ error: 'Booking sheet not configured' });
    }
    res.json(availability);
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Static files
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: 'index.html'
}));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Run database migrations on startup
async function runMigrations() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  try {
    await pool.query(`
      ALTER TABLE applications
        ADD COLUMN IF NOT EXISTS mollie_payment_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
        ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMP WITH TIME ZONE
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_applications_mollie_id ON applications(mollie_payment_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_applications_payment_status ON applications(payment_status)');

    // Add accommodation/food add-on columns
    await pool.query(`
      ALTER TABLE applications
        ADD COLUMN IF NOT EXISTS need_accommodation BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS want_food BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS accommodation_type VARCHAR(50)
    `);

    // Form restructure columns (migration 004)
    await pool.query(`
      ALTER TABLE applications
        ADD COLUMN IF NOT EXISTS selected_weeks TEXT[],
        ADD COLUMN IF NOT EXISTS top_themes TEXT[],
        ADD COLUMN IF NOT EXISTS belief_update TEXT,
        ADD COLUMN IF NOT EXISTS volunteer_interest BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS coupon_code TEXT,
        ADD COLUMN IF NOT EXISTS food_preference TEXT,
        ADD COLUMN IF NOT EXISTS accessibility_needs TEXT
    `);

    // Rename resend_id → message_id in email_log (legacy column name)
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'email_log' AND column_name = 'resend_id'
    `);
    if (colCheck.rows.length > 0) {
      await pool.query('ALTER TABLE email_log RENAME COLUMN resend_id TO message_id');
      console.log('Renamed email_log.resend_id → message_id');
    }

    console.log('Database migrations complete');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

runMigrations().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Valley of the Commons server running on port ${PORT}`);
  });
});
