// Application form API endpoint
// Handles full event applications with PostgreSQL storage and Mailcow SMTP emails

const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { syncApplication } = require('./google-sheets');
const { createPayment, TICKET_LABELS, calculateAmount } = require('./mollie');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Initialize SMTP transport (Mailcow)
const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.rmail.online',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'newsletter@valleyofthecommons.com',
    pass: process.env.SMTP_PASS || '',
  },
  tls: { rejectUnauthorized: false },
});

// Week labels for email display
const WEEK_LABELS = {
  week1: 'Week 1: Return to the Commons (Aug 24-30)',
  week2: 'Week 2: Post-Capitalist Production (Aug 31-Sep 6)',
  week3: 'Week 3: Future Living (Sep 7-13)',
  week4: 'Week 4: Governance & Funding Models (Sep 14-20)',
};

// Email templates
const confirmationEmail = (application) => {
  const ticketLabel = TICKET_LABELS[application.contribution_amount] || application.contribution_amount || 'Not selected';
  const amount = application.contribution_amount ? calculateAmount(application.contribution_amount, (application.weeks || []).length) : null;
  const weeksHtml = (application.weeks || []).map(w => `<li>${WEEK_LABELS[w] || w}</li>`).join('');

  return {
    subject: 'Application Received - Valley of the Commons',
    html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2d5016; margin-bottom: 24px;">Thank You for Applying!</h1>

      <p>Dear ${application.first_name},</p>

      <p>We've received your application to join <strong>Valley of the Commons</strong> (August 24 - September 20, 2026).</p>

      <div style="background: #f5f5f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #2d5016;">Your Booking Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Ticket:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">${ticketLabel}</td>
          </tr>
          ${amount ? `<tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Amount:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">&euro;${amount}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Attendance:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">${application.attendance_type === 'full' ? 'Full 4 weeks' : 'Partial'}</td>
          </tr>
        </table>
        ${weeksHtml ? `<p style="margin-top: 12px; margin-bottom: 0;"><strong>Weeks selected:</strong></p><ul style="margin-top: 4px; margin-bottom: 0;">${weeksHtml}</ul>` : ''}
      </div>

      <div style="background: #f5f5f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #2d5016;">What happens next?</h3>
        <ol style="margin-bottom: 0;">
          <li>Complete your payment (if you haven't already)</li>
          <li>Our team will review your application</li>
          <li>We may reach out with follow-up questions</li>
          <li>You'll receive a decision within 2-3 weeks</li>
        </ol>
      </div>

      <p>In the meantime, feel free to explore more about the Commons Hub and our community:</p>
      <ul>
        <li><a href="https://www.commons-hub.at/">Commons Hub Website</a></li>
        <li><a href="https://valleyofthecommons.com/">Valley of the Commons</a></li>
      </ul>

      <p>If you have any questions, reply to this email and we'll get back to you.</p>

      <p style="margin-top: 32px;">
        With warmth,<br>
        <strong>The Valley of the Commons Team</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">
      <p style="font-size: 12px; color: #666;">
        Application ID: ${application.id}<br>
        Submitted: ${new Date(application.submitted_at).toLocaleDateString('en-US', { dateStyle: 'long' })}
      </p>
    </div>
  `
  };
};

const adminNotificationEmail = (application) => ({
  subject: `New Application: ${application.first_name} ${application.last_name}`,
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2d5016;">New Application Received</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${application.first_name} ${application.last_name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${application.email}">${application.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${application.city || ''}, ${application.country || ''}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Attendance:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${application.attendance_type === 'full' ? 'Full 4 weeks' : 'Partial'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Scholarship:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${application.scholarship_needed ? 'Yes' : 'No'}</td>
        </tr>
      </table>

      <div style="background: #f5f5f0; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0;">Motivation</h3>
        <p style="margin-bottom: 0; white-space: pre-wrap;">${application.motivation}</p>
      </div>

      <p>
        <a href="https://valleyofthecommons.com/admin.html" style="display: inline-block; background: #2d5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Review Application
        </a>
      </p>

      <p style="font-size: 12px; color: #666; margin-top: 24px;">
        Application ID: ${application.id}
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST - Submit new application
  if (req.method === 'POST') {
    try {
      const data = req.body;

      // Validate required fields
      const required = ['first_name', 'last_name', 'email', 'motivation', 'code_of_conduct_accepted', 'privacy_policy_accepted'];
      for (const field of required) {
        if (!data[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Validate email format
      if (!data.email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      // Check for duplicate application
      const existing = await pool.query(
        'SELECT id FROM applications WHERE email = $1',
        [data.email.toLowerCase().trim()]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'An application with this email already exists',
          applicationId: existing.rows[0].id
        });
      }

      // Prepare arrays for PostgreSQL
      const skills = Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : null);
      const languages = Array.isArray(data.languages) ? data.languages : (data.languages ? [data.languages] : null);
      const dietary = Array.isArray(data.dietary_requirements) ? data.dietary_requirements : (data.dietary_requirements ? [data.dietary_requirements] : null);
      const governance = Array.isArray(data.governance_interest) ? data.governance_interest : (data.governance_interest ? [data.governance_interest] : null);
      const previousEvents = Array.isArray(data.previous_events) ? data.previous_events : (data.previous_events ? [data.previous_events] : null);

      // Insert application
      const result = await pool.query(
        `INSERT INTO applications (
          first_name, last_name, email, phone, country, city, pronouns, date_of_birth,
          occupation, organization, skills, languages, website, social_links,
          attendance_type, arrival_date, departure_date, accommodation_preference,
          dietary_requirements, dietary_notes, motivation, contribution, projects,
          workshops_offer, commons_experience, community_experience, governance_interest,
          how_heard, referral_name, previous_events, emergency_name, emergency_phone,
          emergency_relationship, code_of_conduct_accepted, privacy_policy_accepted,
          photo_consent, scholarship_needed, scholarship_reason, contribution_amount,
          ip_address, user_agent
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
          $33, $34, $35, $36, $37, $38, $39, $40, $41
        ) RETURNING id, submitted_at`,
        [
          data.first_name?.trim(),
          data.last_name?.trim(),
          data.email?.toLowerCase().trim(),
          data.phone?.trim() || null,
          data.country?.trim() || null,
          data.city?.trim() || null,
          data.pronouns?.trim() || null,
          data.date_of_birth || null,
          data.occupation?.trim() || null,
          data.organization?.trim() || null,
          skills,
          languages,
          data.website?.trim() || null,
          data.social_links ? JSON.stringify(data.social_links) : null,
          data.attendance_type || 'full',
          data.arrival_date || null,
          data.departure_date || null,
          data.accommodation_preference || null,
          dietary,
          data.dietary_notes?.trim() || null,
          data.motivation?.trim(),
          data.contribution?.trim() || null,
          data.projects?.trim() || null,
          data.workshops_offer?.trim() || null,
          data.commons_experience?.trim() || null,
          data.community_experience?.trim() || null,
          governance,
          data.how_heard?.trim() || null,
          data.referral_name?.trim() || null,
          previousEvents,
          data.emergency_name?.trim() || null,
          data.emergency_phone?.trim() || null,
          data.emergency_relationship?.trim() || null,
          data.code_of_conduct_accepted || false,
          data.privacy_policy_accepted || false,
          data.photo_consent || false,
          data.scholarship_needed || false,
          data.scholarship_reason?.trim() || null,
          data.contribution_amount || null,
          req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
          req.headers['user-agent'] || null
        ]
      );

      const weeksSelected = Array.isArray(data.weeks) ? data.weeks : [];
      const application = {
        id: result.rows[0].id,
        submitted_at: result.rows[0].submitted_at,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        city: data.city,
        country: data.country,
        attendance_type: data.attendance_type,
        scholarship_needed: data.scholarship_needed,
        scholarship_reason: data.scholarship_reason,
        motivation: data.motivation,
        contribution: data.contribution,
        how_heard: data.how_heard,
        referral_name: data.referral_name,
        arrival_date: data.arrival_date,
        departure_date: data.departure_date,
        weeks: weeksSelected,
        contribution_amount: data.contribution_amount,
      };

      // Sync to Google Sheets (fire-and-forget backup)
      syncApplication(application);

      // Send confirmation email to applicant
      if (process.env.SMTP_PASS) {
        try {
          const confirmEmail = confirmationEmail(application);
          const info = await smtp.sendMail({
            from: process.env.EMAIL_FROM || 'Valley of the Commons <newsletter@valleyofthecommons.com>',
            to: application.email,
            subject: confirmEmail.subject,
            html: confirmEmail.html,
          });
          await logEmail(application.email, `${application.first_name} ${application.last_name}`,
            'application_confirmation', confirmEmail.subject, info.messageId, { applicationId: application.id });
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
        }

        // Send notification to admins
        try {
          const adminEmail = adminNotificationEmail(application);
          const adminRecipients = (process.env.ADMIN_EMAILS || 'jeff@jeffemmett.com').split(',');
          const info = await smtp.sendMail({
            from: process.env.EMAIL_FROM || 'Valley of the Commons <newsletter@valleyofthecommons.com>',
            to: adminRecipients.join(', '),
            subject: adminEmail.subject,
            html: adminEmail.html,
          });
          await logEmail(adminRecipients[0], 'Admin', 'admin_notification',
            adminEmail.subject, info.messageId, { applicationId: application.id });
        } catch (emailError) {
          console.error('Failed to send admin notification:', emailError);
        }
      }

      // Create Mollie payment if ticket was selected and Mollie is configured
      let checkoutUrl = null;
      if (data.contribution_amount && process.env.MOLLIE_API_KEY) {
        try {
          const weeksCount = Array.isArray(data.weeks) ? data.weeks.length : 1;
          const paymentResult = await createPayment(
            application.id,
            data.contribution_amount,
            weeksCount,
            application.email,
            application.first_name,
            application.last_name
          );
          checkoutUrl = paymentResult.checkoutUrl;
          console.log(`Mollie payment created: ${paymentResult.paymentId} (${paymentResult.amount} EUR)`);
        } catch (paymentError) {
          console.error('Failed to create Mollie payment:', paymentError);
          // Don't fail the application - payment can be retried
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.id,
        checkoutUrl,
      });

    } catch (error) {
      console.error('Application submission error:', error);
      return res.status(500).json({ error: 'Failed to submit application. Please try again.' });
    }
  }

  // GET - Retrieve applications (admin only)
  if (req.method === 'GET') {
    // Simple token-based auth for admin access
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = 'SELECT * FROM applications';
      const params = [];

      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }

      query += ` ORDER BY submitted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM applications';
      if (status) {
        countQuery += ' WHERE status = $1';
      }
      const countResult = await pool.query(countQuery, status ? [status] : []);

      return res.status(200).json({
        applications: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('Failed to fetch applications:', error);
      return res.status(500).json({ error: 'Failed to fetch applications' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
