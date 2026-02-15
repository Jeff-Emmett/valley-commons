// Waitlist API endpoint using PostgreSQL
// Simple interest signups with email confirmation via Mailcow SMTP

const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize SMTP transport (Mailcow)
const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mx.jeffemmett.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'noreply@jeffemmett.com',
    pass: process.env.SMTP_PASS || '',
  },
});

const welcomeEmail = (signup) => ({
  subject: 'Welcome to Valley of the Commons',
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2d5016; margin-bottom: 24px;">Welcome to the Valley!</h1>

      <p>Dear ${signup.name},</p>

      <p>Thank you for your interest in <strong>Valley of the Commons</strong> - a four-week pop-up village in the Austrian Alps (August 24 - September 20, 2026).</p>

      <p>You've been added to our community list. We'll keep you updated on:</p>
      <ul>
        <li>Application opening and deadlines</li>
        <li>Event announcements and updates</li>
        <li>Ways to get involved</li>
      </ul>

      ${signup.involvement ? `
      <div style="background: #f5f5f0; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <strong>Your interests:</strong>
        <p style="margin-bottom: 0;">${signup.involvement}</p>
      </div>
      ` : ''}

      <p>
        <a href="https://votc.jeffemmett.com/apply.html" style="display: inline-block; background: #2d5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Apply Now
        </a>
      </p>

      <p style="margin-top: 32px;">
        See you in the valley,<br>
        <strong>The Valley of the Commons Team</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">
      <p style="font-size: 12px; color: #666;">
        You received this email because you signed up at votc.jeffemmett.com.<br>
        <a href="https://votc.jeffemmett.com/unsubscribe?email=${encodeURIComponent(signup.email)}">Unsubscribe</a>
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

    // Send welcome email
    if (process.env.SMTP_PASS) {
      try {
        const email = welcomeEmail(signup);
        const info = await smtp.sendMail({
          from: process.env.EMAIL_FROM || 'Valley of the Commons <noreply@jeffemmett.com>',
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
