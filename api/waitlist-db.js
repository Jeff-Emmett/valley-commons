// Waitlist API endpoint using PostgreSQL
// Simple interest signups with email confirmation via Mailcow SMTP

const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { syncWaitlistSignup } = require('./google-sheets');
const { addToListmonk } = require('./listmonk');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Initialize SMTP transport (Mailcow)
const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.rmail.online',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'contact@valleyofthecommons.com',
    pass: process.env.SMTP_PASS || '',
  },
  tls: { rejectUnauthorized: false },
});

const welcomeEmail = (signup) => ({
  subject: 'Welcome to the Valley — A Village Built on Common Ground',
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h1 style="color: #2d5016; margin-bottom: 8px;">Welcome to the Valley!</h1>
      <p style="font-size: 15px; color: #5a7a3a; margin-top: 0; margin-bottom: 28px; font-style: italic;">A village built on common ground</p>

      <p>Dear ${signup.name},</p>

      <p>Thank you for stepping toward something different. <strong>Valley of the Commons</strong> is a four-week pop-up village in Austria's Höllental Valley (August 24 – September 20, 2026) — a living commons shared in work and study, in making and care, in governance and everyday life.</p>

      <p>For four weeks, we'll come together to lay the foundations for life beyond extractive systems. Each week explores a different dimension of what a commons-based society can look like:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #e8e8e0;">
          <td style="padding: 10px 12px; font-weight: bold; color: #2d5016; white-space: nowrap;">Week 1</td>
          <td style="padding: 10px 12px;">Return of the Commons</td>
        </tr>
        <tr style="border-bottom: 1px solid #e8e8e0; background: #fafaf5;">
          <td style="padding: 10px 12px; font-weight: bold; color: #2d5016; white-space: nowrap;">Week 2</td>
          <td style="padding: 10px 12px;">Cosmo-local Production & Open Value Accounting</td>
        </tr>
        <tr style="border-bottom: 1px solid #e8e8e0;">
          <td style="padding: 10px 12px; font-weight: bold; color: #2d5016; white-space: nowrap;">Week 3</td>
          <td style="padding: 10px 12px;">Future Living</td>
        </tr>
        <tr style="background: #fafaf5;">
          <td style="padding: 10px 12px; font-weight: bold; color: #2d5016; white-space: nowrap;">Week 4</td>
          <td style="padding: 10px 12px;">Governance & Funding</td>
        </tr>
      </table>

      <p>Mornings are structured learning paths. Afternoons host workshops, field visits, and working groups. And in between — shared meals, hikes into the Alps, river swimming, mushroom foraging, fire circles, and the kind of conversations that only happen when people live and build together.</p>

      ${signup.involvement ? `
      <div style="background: #f5f5f0; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 3px solid #2d5016;">
        <strong style="color: #2d5016;">What you're bringing:</strong>
        <p style="margin-bottom: 0; margin-top: 8px;">${signup.involvement}</p>
      </div>
      ` : ''}

      <p>We'll be in touch with application details, event updates, and ways to get involved as the village takes shape.</p>

      <p style="text-align: center; margin: 28px 0;">
        <a href="https://valleyofthecommons.com/apply.html" style="display: inline-block; background: #2d5016; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
          Apply Now
        </a>
      </p>

      <p style="margin-top: 32px;">
        See you in the valley,<br>
        <strong>The Valley of the Commons Team</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">
      <p style="font-size: 12px; color: #666;">
        You received this email because you signed up at valleyofthecommons.com.<br>
        <a href="https://valleyofthecommons.com/unsubscribe?email=${encodeURIComponent(signup.email)}">Unsubscribe</a>
      </p>
    </div>
  `
});

async function logEmail(recipientEmail, recipientName, emailType, subject, messageId, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO email_log (recipient_email, recipient_name, email_type, subject, message_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [recipientEmail, recipientName, emailType, subject, messageId, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Failed to log email:', error);
  }
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, name, involvement } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Validate name
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate involvement
    if (!involvement || involvement.trim() === '') {
      return res.status(400).json({ error: 'Please describe your desired involvement' });
    }

    const emailLower = email.toLowerCase().trim();
    const nameTrimmed = name.trim();
    const involvementTrimmed = involvement.trim();

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM waitlist WHERE email = $1',
      [emailLower]
    );

    if (existing.rows.length > 0) {
      // Update existing entry
      await pool.query(
        'UPDATE waitlist SET name = $1, involvement = $2 WHERE email = $3',
        [nameTrimmed, involvementTrimmed, emailLower]
      );
      return res.status(200).json({
        success: true,
        message: 'Your information has been updated!'
      });
    }

    // Insert new signup
    const result = await pool.query(
      `INSERT INTO waitlist (email, name, involvement) VALUES ($1, $2, $3) RETURNING id`,
      [emailLower, nameTrimmed, involvementTrimmed]
    );

    const signup = {
      id: result.rows[0].id,
      email: emailLower,
      name: nameTrimmed,
      involvement: involvementTrimmed
    };

    // Sync to Google Sheets (fire-and-forget backup)
    syncWaitlistSignup(signup);

    // Add to Listmonk newsletter
    addToListmonk(signup.email, signup.name, {
      involvement: signup.involvement,
      source: 'waitlist',
    }).catch(err => console.error('[Listmonk] Waitlist sync failed:', err.message));

    // Send welcome email
    if (process.env.SMTP_PASS) {
      try {
        const email = welcomeEmail(signup);
        const info = await smtp.sendMail({
          from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
          to: signup.email,
          subject: email.subject,
          html: email.html,
        });
        await logEmail(signup.email, signup.name, 'waitlist_welcome', email.subject, info.messageId);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully joined the waitlist!'
    });

  } catch (error) {
    console.error('Waitlist error:', error);
    return res.status(500).json({ error: 'Failed to join waitlist. Please try again later.' });
  }
};
