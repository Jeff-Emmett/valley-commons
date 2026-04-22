// Application form API endpoint
// Handles full event applications with PostgreSQL storage and Mailcow SMTP emails

const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { syncApplication } = require('./google-sheets');
const { createPayment, TICKET_LABELS, REGISTRATION_PRICING, ACCOMMODATION_PRICES, ACCOMMODATION_LABELS, PROCESSING_FEE_PERCENT, calculateAmount, getPricingTier } = require('./mollie');
const { addToListmonk } = require('./listmonk');

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
    user: process.env.SMTP_USER || 'contact@valleyofthecommons.com',
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
  const weeksCount = (application.weeks || []).length;
  const accomType = application.accommodation_type || null;
  const pricing = calculateAmount('registration', weeksCount, accomType);
  const weeksHtml = (application.weeks || []).map(w => `<li>${WEEK_LABELS[w] || w}</li>`).join('');

  // Accommodation row
  let accomHtml = '';
  if (accomType && ACCOMMODATION_PRICES[accomType]) {
    const label = ACCOMMODATION_LABELS[accomType] || accomType;
    const accomPrices = ACCOMMODATION_PRICES[accomType];
    const accomDisplay = weeksCount === 4
      ? `${label} — &euro;${accomPrices.perMonth} (full month)`
      : `${label} — &euro;${accomPrices.perWeek}/week &times; ${weeksCount} week${weeksCount > 1 ? 's' : ''} = &euro;${pricing.accommodation}`;
    accomHtml = `
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Accommodation:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">${accomDisplay}</td>
          </tr>`;
  }

  // Food note
  const foodNote = application.want_food
    ? '<tr><td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Food:</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">Interest registered — we are exploring co-producing meals as a community. More details and costs coming soon.</td></tr>'
    : '';

  return {
    subject: 'Welcome to the Process - Valley of the Commons',
    html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2d5016; margin-bottom: 24px;">We're glad you're here, ${application.first_name}!</h1>

      <p>Your application to <strong>Valley of the Commons</strong> (August 24 – September 20, 2026) has been received. We're excited to read about what you'll bring to the village.</p>

      <div style="background: #f5f5f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #2d5016;">Your Booking Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Registration:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">${weeksCount === 4 ? `&euro;${pricing.registration} (full month)` : `&euro;${REGISTRATION_PRICING[pricing.tier].perWeek}/week &times; ${weeksCount} week${weeksCount > 1 ? 's' : ''} = &euro;${pricing.registration}`} (${pricing.tier === 'early' ? 'Early Bird' : pricing.tier === 'standard' ? 'Standard' : 'Last Minute'} rate)</td>
          </tr>
          ${accomHtml}
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Processing fee (2%):</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">&euro;${pricing.processingFee}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Total:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>&euro;${pricing.total}</strong></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;"><strong>Attendance:</strong></td>
            <td style="padding: 6px 0; border-bottom: 1px solid #e0e0e0;">${application.attendance_type === 'full' ? 'Full 4 weeks' : 'Partial'}</td>
          </tr>
          ${foodNote}
        </table>
        ${weeksHtml ? `<p style="margin-top: 12px; margin-bottom: 0;"><strong>Weeks selected:</strong></p><ul style="margin-top: 4px; margin-bottom: 0;">${weeksHtml}</ul>` : ''}
      </div>

      <div style="background: #f5f5f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #2d5016;">What happens next?</h3>
        <ol style="margin-bottom: 0;">
          <li><a href="${process.env.BASE_URL || 'https://valleyofthecommons.com'}/api/mollie/resume?id=${application.id}" style="color: #2d5016; font-weight: 600;">Complete your registration payment</a> (if you haven't already)</li>
          <li>Our team will review your application within <strong>1 week</strong></li>
          <li>We may reach out with follow-up questions</li>
          ${accomType ? '<li>Your accommodation will be allocated and details sent to you shortly after payment is confirmed</li>' : ''}
        </ol>
      </div>

      <p>In the meantime, feel free to explore more about the Commons Hub and our community:</p>
      <ul>
        <li><a href="https://www.commons-hub.at/">Commons Hub Website</a></li>
        <li><a href="https://valleyofthecommons.com/">Valley of the Commons</a></li>
      </ul>

      <p>If you have any questions, just reply to this email — we'd love to hear from you.</p>

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
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Accommodation:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${application.accommodation_type ? (ACCOMMODATION_LABELS[application.accommodation_type] || application.accommodation_type) : (application.need_accommodation ? 'Yes (no type selected)' : 'No')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Food interest:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${application.want_food ? 'Yes — wants to co-produce meals' : 'No'}</td>
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST - Submit new application
  if (req.method === 'POST') {
    try {
      const data = req.body;

      // Validate required fields
      const required = ['first_name', 'last_name', 'email', 'motivation', 'belief_update', 'privacy_policy_accepted'];
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
        'SELECT id FROM applications WHERE email = $1 ORDER BY submitted_at DESC LIMIT 1',
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

      // Prepare new array fields
      const selectedWeeks = Array.isArray(data.weeks) ? data.weeks : (data.weeks ? [data.weeks] : []);
      const topThemes = Array.isArray(data.top_themes) ? data.top_themes : (data.top_themes ? [data.top_themes] : null);

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
          ip_address, user_agent, need_accommodation, want_food, accommodation_type,
          selected_weeks, top_themes, belief_update, volunteer_interest, coupon_code,
          food_preference, accessibility_needs
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
          $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
          $45, $46, $47, $48, $49, $50, $51
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
          'registration',
          req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
          req.headers['user-agent'] || null,
          data.need_accommodation || false,
          data.want_food || false,
          data.accommodation_type || null,
          selectedWeeks.length > 0 ? selectedWeeks : null,
          topThemes,
          data.belief_update?.trim() || null,
          data.volunteer_interest || false,
          data.coupon_code?.trim() || null,
          data.food_preference?.trim() || null,
          data.accessibility_needs?.trim() || null
        ]
      );

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
        weeks: selectedWeeks,
        need_accommodation: data.need_accommodation || false,
        accommodation_preference: data.accommodation_preference || null,
        accommodation_type: data.accommodation_type || null,
        want_food: data.want_food || false,
        contribution_amount: 'registration',
      };

      // Sync to Google Sheets (fire-and-forget backup)
      syncApplication(application);

      // Add to Listmonk newsletter
      addToListmonk(application.email, `${application.first_name} ${application.last_name}`, {
        source: 'application',
        weeks: selectedWeeks,
        contributionAmount: data.contribution_amount,
      }).catch(err => console.error('[Listmonk] Application sync failed:', err.message));

      // Send confirmation email to applicant
      if (process.env.SMTP_PASS) {
        try {
          const confirmEmail = confirmationEmail(application);
          const info = await smtp.sendMail({
            from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
            to: application.email,
            bcc: [process.env.TEAM_BCC || 'team@valleyofthecommons.com', process.env.GLOBAL_ADMIN_BCC || 'jeff@jeffemmett.com'].filter(Boolean).join(', '),
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
            from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
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

      // Create Mollie payment for registration + accommodation fee
      let checkoutUrl = null;
      if (selectedWeeks.length > 0 && process.env.MOLLIE_API_KEY) {
        try {
          const paymentResult = await createPayment(
            application.id,
            'registration',
            selectedWeeks.length,
            application.email,
            application.first_name,
            application.last_name,
            application.accommodation_type,
            selectedWeeks
          );
          checkoutUrl = paymentResult.checkoutUrl;
          console.log(`Mollie payment created: ${paymentResult.paymentId} (€${paymentResult.amount})`);
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

  // PUT - Update existing application
  if (req.method === 'PUT') {
    try {
      const data = req.body;

      // Validate required fields
      const required = ['first_name', 'last_name', 'email', 'motivation', 'belief_update', 'privacy_policy_accepted'];
      for (const field of required) {
        if (!data[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Find existing application by email
      const existing = await pool.query(
        'SELECT id, payment_status, submitted_at, status FROM applications WHERE email = $1 ORDER BY submitted_at DESC LIMIT 1',
        [data.email.toLowerCase().trim()]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'No application found with this email' });
      }

      const app = existing.rows[0];

      // If already paid, don't allow re-submission
      if (app.payment_status === 'paid') {
        return res.status(400).json({
          error: 'This application has already been paid. Contact us if you need to make changes.',
          paid: true,
          applicationId: app.id
        });
      }

      // Prepare arrays for PostgreSQL
      const skills = Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : null);
      const languages = Array.isArray(data.languages) ? data.languages : (data.languages ? [data.languages] : null);
      const dietary = Array.isArray(data.dietary_requirements) ? data.dietary_requirements : (data.dietary_requirements ? [data.dietary_requirements] : null);
      const governance = Array.isArray(data.governance_interest) ? data.governance_interest : (data.governance_interest ? [data.governance_interest] : null);
      const previousEvents = Array.isArray(data.previous_events) ? data.previous_events : (data.previous_events ? [data.previous_events] : null);
      const selectedWeeks = Array.isArray(data.weeks) ? data.weeks : (data.weeks ? [data.weeks] : []);
      const topThemes = Array.isArray(data.top_themes) ? data.top_themes : (data.top_themes ? [data.top_themes] : null);

      // Update the application
      await pool.query(
        `UPDATE applications SET
          first_name = $1, last_name = $2, phone = $3, country = $4, city = $5,
          pronouns = $6, date_of_birth = $7, occupation = $8, organization = $9,
          skills = $10, languages = $11, website = $12, social_links = $13,
          attendance_type = $14, arrival_date = $15, departure_date = $16,
          accommodation_preference = $17, dietary_requirements = $18, dietary_notes = $19,
          motivation = $20, contribution = $21, projects = $22, workshops_offer = $23,
          commons_experience = $24, community_experience = $25, governance_interest = $26,
          how_heard = $27, referral_name = $28, previous_events = $29,
          emergency_name = $30, emergency_phone = $31, emergency_relationship = $32,
          code_of_conduct_accepted = $33, privacy_policy_accepted = $34, photo_consent = $35,
          scholarship_needed = $36, scholarship_reason = $37, need_accommodation = $38,
          want_food = $39, accommodation_type = $40, selected_weeks = $41,
          top_themes = $42, belief_update = $43, volunteer_interest = $44,
          coupon_code = $45, food_preference = $46, accessibility_needs = $47
        WHERE id = $48`,
        [
          data.first_name?.trim(),
          data.last_name?.trim(),
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
          data.need_accommodation || false,
          data.want_food || false,
          data.accommodation_type || null,
          selectedWeeks.length > 0 ? selectedWeeks : null,
          topThemes,
          data.belief_update?.trim() || null,
          data.volunteer_interest || false,
          data.coupon_code?.trim() || null,
          data.food_preference?.trim() || null,
          data.accessibility_needs?.trim() || null,
          app.id
        ]
      );

      const application = {
        id: app.id,
        submitted_at: app.submitted_at,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        weeks: selectedWeeks,
        accommodation_type: data.accommodation_type || null,
      };

      // Create Mollie payment
      let checkoutUrl = null;
      if (selectedWeeks.length > 0 && process.env.MOLLIE_API_KEY) {
        try {
          const paymentResult = await createPayment(
            app.id,
            'registration',
            selectedWeeks.length,
            data.email.toLowerCase().trim(),
            data.first_name,
            data.last_name,
            data.accommodation_type,
            selectedWeeks
          );
          checkoutUrl = paymentResult.checkoutUrl;
          console.log(`Mollie payment created (update): ${paymentResult.paymentId} (€${paymentResult.amount})`);
        } catch (paymentError) {
          console.error('Failed to create Mollie payment:', paymentError);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Application updated successfully',
        applicationId: app.id,
        checkoutUrl,
      });

    } catch (error) {
      console.error('Application update error:', error);
      return res.status(500).json({ error: 'Failed to update application. Please try again.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// Lookup handler - public endpoint to check if an application exists by email
module.exports.lookup = async function lookupHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = (req.query.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, phone, country, city, pronouns,
              date_of_birth, occupation, organization, skills, languages, website,
              social_links, attendance_type, arrival_date, departure_date,
              accommodation_preference, dietary_requirements, dietary_notes,
              motivation, contribution, projects, workshops_offer, commons_experience,
              community_experience, governance_interest, how_heard, referral_name,
              previous_events, emergency_name, emergency_phone, emergency_relationship,
              code_of_conduct_accepted, privacy_policy_accepted, photo_consent,
              scholarship_needed, scholarship_reason, need_accommodation, want_food,
              accommodation_type, selected_weeks, top_themes, belief_update,
              volunteer_interest, coupon_code, food_preference, accessibility_needs,
              payment_status, submitted_at
       FROM applications WHERE email = $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ found: false });
    }

    const row = result.rows[0];

    // Map DB column names to frontend form field names that restoreFormData() expects
    const mapped = {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      social_links: row.social_links,
      how_heard: row.how_heard,
      referral_name: row.referral_name,
      affiliations: row.commons_experience,
      motivation: row.motivation,
      current_work: row.projects,
      contribution: row.contribution,
      themes_familiarity: row.workshops_offer,
      belief_update: row.belief_update,
      weeks: row.selected_weeks || [],
      top_themes: row.top_themes || [],
      need_accommodation: row.need_accommodation,
      accommodation_type: row.accommodation_type,
      food_preference: row.food_preference,
      accessibility_needs: row.accessibility_needs,
      volunteer_interest: row.volunteer_interest,
      coupon_code: row.coupon_code,
      privacy_policy_accepted: row.privacy_policy_accepted,
      payment_status: row.payment_status,
      submitted_at: row.submitted_at,
    };

    return res.status(200).json({ found: true, application: mapped });

  } catch (error) {
    console.error('Application lookup error:', error);
    return res.status(500).json({ error: 'Lookup failed' });
  }
};

// Sponsor comp registration — skips Mollie entirely.
// Lives at POST /api/application/sponsor. Creates an application row with
// payment_status='paid', payment_amount=0, and immediately assigns a bed
// (if requested) + sends confirmation emails, mirroring what the Mollie
// webhook does on a successful paid payment.
module.exports.sponsor = async function sponsorHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body || {};
    const required = ['first_name', 'last_name', 'email'];
    for (const field of required) {
      if (!data[field]) return res.status(400).json({ error: `Missing required field: ${field}` });
    }
    if (!data.email.includes('@')) return res.status(400).json({ error: 'Invalid email address' });

    const selectedWeeks = Array.isArray(data.selected_weeks) ? data.selected_weeks : [];
    if (selectedWeeks.length === 0) {
      return res.status(400).json({ error: 'Please select at least one week' });
    }

    const email = data.email.toLowerCase().trim();

    // Block duplicate applications from the same email.
    const existing = await pool.query(
      'SELECT id FROM applications WHERE email = $1 ORDER BY submitted_at DESC LIMIT 1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An application with this email already exists',
        applicationId: existing.rows[0].id,
      });
    }

    const result = await pool.query(
      `INSERT INTO applications (
        first_name, last_name, email, organization,
        attendance_type, dietary_notes, code_of_conduct_accepted, privacy_policy_accepted,
        contribution_amount, ip_address, user_agent,
        need_accommodation, accommodation_type, selected_weeks,
        coupon_code, payment_status, payment_amount, payment_paid_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'paid',0.00, CURRENT_TIMESTAMP
      ) RETURNING id, submitted_at`,
      [
        data.first_name.trim(),
        data.last_name.trim(),
        email,
        data.organization?.trim() || null,
        'full',
        data.dietary_notes?.trim() || null,
        !!data.code_of_conduct_accepted,
        true,
        'sponsor_comp',
        req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
        req.headers['user-agent'] || null,
        !!data.need_accommodation,
        data.accommodation_type || null,
        selectedWeeks,
        'weloveoursponsors',
      ]
    );

    const application = {
      id: result.rows[0].id,
      submitted_at: result.rows[0].submitted_at,
      first_name: data.first_name,
      last_name: data.last_name,
      email,
      accommodation_type: data.accommodation_type || null,
      payment_amount: '0.00',
      mollie_payment_id: `sponsor-${result.rows[0].id}`,
    };

    // Bed assignment if requested — non-fatal.
    let bookingResult = null;
    if (application.accommodation_type) {
      try {
        const { assignBooking } = require('./booking-sheet');
        bookingResult = await assignBooking(
          `${application.first_name} ${application.last_name}`,
          application.accommodation_type,
          selectedWeeks
        );
      } catch (err) {
        console.error('[Sponsor] Bed assignment error (non-fatal):', err.message);
        bookingResult = { success: false, reason: err.message };
      }
    }

    // Sync to sheets + Listmonk — fire and forget.
    syncApplication({
      ...application,
      weeks: selectedWeeks,
      need_accommodation: !!data.need_accommodation,
      contribution_amount: 'sponsor_comp',
    });
    addToListmonk(email, `${application.first_name} ${application.last_name}`, {
      source: 'sponsor',
      weeks: selectedWeeks,
    }).catch((err) => console.error('[Listmonk] Sponsor sync failed:', err.message));

    // Confirmation + internal notification emails.
    if (process.env.SMTP_PASS) {
      try {
        await smtp.sendMail({
          from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
          to: email,
          bcc: [process.env.TEAM_BCC || 'team@valleyofthecommons.com', process.env.GLOBAL_ADMIN_BCC || 'jeff@jeffemmett.com'].filter(Boolean).join(', '),
          subject: 'Sponsor Registration Confirmed — Valley of the Commons',
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2c2c2c;">
              <h1 style="color: #2d5016;">Thank you for sponsoring Valley of the Commons</h1>
              <p>Dear ${application.first_name},</p>
              <p>Your complimentary sponsor registration is confirmed. We're delighted you'll be with us.</p>
              <p><strong>Weeks attending:</strong> ${selectedWeeks.join(', ')}</p>
              ${application.accommodation_type ? `<p><strong>Accommodation request:</strong> ${application.accommodation_type}${bookingResult?.success ? ` — assigned to ${bookingResult.venue} Room ${bookingResult.room} (${bookingResult.bedType})` : ' — our team will follow up with your room assignment'}</p>` : ''}
              <p>If you have any questions, reply to this email.</p>
              <p style="margin-top: 32px;">With warmth,<br><strong>The Valley of the Commons Team</strong></p>
            </div>`,
        });
      } catch (err) {
        console.error('[Sponsor] Confirmation email failed:', err.message);
      }

      try {
        const adminRecipients = (process.env.ADMIN_EMAILS || 'jeff@jeffemmett.com').split(',');
        await smtp.sendMail({
          from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
          to: adminRecipients.join(', '),
          subject: `Sponsor registration: ${application.first_name} ${application.last_name}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>New sponsor registration</h2>
              <p><strong>Name:</strong> ${application.first_name} ${application.last_name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Organisation:</strong> ${data.organization || '—'}</p>
              <p><strong>Weeks:</strong> ${selectedWeeks.join(', ')}</p>
              <p><strong>Accommodation:</strong> ${application.accommodation_type || 'none'}</p>
              ${bookingResult ? `<p><strong>Bed:</strong> ${bookingResult.success ? `${bookingResult.venue} Room ${bookingResult.room} (${bookingResult.bedType})` : `MANUAL ASSIGNMENT NEEDED — ${bookingResult.reason || 'n/a'}`}</p>` : ''}
            </div>`,
        });
      } catch (err) {
        console.error('[Sponsor] Admin notification failed:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      applicationId: application.id,
    });
  } catch (error) {
    console.error('Sponsor registration error:', error);
    return res.status(500).json({ error: 'Failed to confirm sponsor registration' });
  }
};
