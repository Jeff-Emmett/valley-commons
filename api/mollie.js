// Mollie payment integration
// Handles payment creation and webhook callbacks

const { createMollieClient } = require('@mollie/api-client');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { assignBooking } = require('./booking-sheet');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Initialize Mollie client
const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY,
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

// Tiered registration pricing (EUR)
// Early Bird: before May 15 | Standard: before July 15 | Last Minute: after July 15
const REGISTRATION_PRICING = {
  early:    { perWeek: 120, perMonth: 300 },
  standard: { perWeek: 200, perMonth: 500 },
  lastMin:  { perWeek: 240, perMonth: 600 },
};

// Processing fee percentage (added on top of subtotal)
const PROCESSING_FEE_PERCENT = 0.02;

// Date-based tier cutoffs
const PRICING_TIER_DATES = {
  earlyEnd:    '2026-05-15',  // before this date → 'early'
  standardEnd: '2026-07-15',  // before this date → 'standard'; after → 'lastMin'
};

function getPricingTier() {
  const now = new Date();
  if (now < new Date(PRICING_TIER_DATES.earlyEnd)) return 'early';
  if (now < new Date(PRICING_TIER_DATES.standardEnd)) return 'standard';
  return 'lastMin';
}

// Accommodation prices (EUR) — flat rates (per week and per month/4-week)
const ACCOMMODATION_PRICES = {
  'ch-multi':  { perWeek: 275,  perMonth: 1100 },
  'ch-double': { perWeek: 350,  perMonth: 1400 },
  'hh-living': { perWeek: 315,  perMonth: 1260 },
  'hh-triple': { perWeek: 350,  perMonth: 1400 },
  'hh-twin':   { perWeek: 420,  perMonth: 1680 },
  'hh-single': { perWeek: 665,  perMonth: 2660 },
  'hh-couple': { perWeek: 700,  perMonth: 2800 },
};

// Human-readable labels for accommodation types
const ACCOMMODATION_LABELS = {
  'ch-multi':  'Commons Hub — Bed in Multi-Room',
  'ch-double': 'Commons Hub — Bed in Double Room',
  'hh-living': 'Herrnhof Villa — Bed in Living Room',
  'hh-triple': 'Herrnhof Villa — Bed in Triple Room',
  'hh-twin':   'Herrnhof Villa — Single Bed in Double Room',
  'hh-single': 'Herrnhof Villa — Single Room',
  'hh-couple': 'Herrnhof Villa — Couple Room',
};

// Legacy ticket labels (kept for backward-compat with existing DB records)
const TICKET_LABELS = {
  'full-dorm': 'Full Resident - Dorm (4-6 people)',
  'full-shared': 'Full Resident - Shared Double',
  'full-single': 'Full Resident - Single (deluxe apartment)',
  'week-dorm': '1-Week Visitor - Dorm (4-6 people)',
  'week-shared': '1-Week Visitor - Shared Double',
  'week-single': '1-Week Visitor - Single (deluxe apartment)',
  'no-accom': 'Non-Accommodation Pass',
  'registration': 'Event Registration',
};

function calculateAmount(ticketType, weeksCount, accommodationType) {
  const weeks = weeksCount || 1;
  const tier = getPricingTier();
  const regPricing = REGISTRATION_PRICING[tier];

  // Full month (4 weeks) gets the month rate; otherwise per-week
  const registration = weeks === 4 ? regPricing.perMonth : regPricing.perWeek * weeks;

  let accommodation = 0;
  if (accommodationType && ACCOMMODATION_PRICES[accommodationType]) {
    const prices = ACCOMMODATION_PRICES[accommodationType];
    accommodation = weeks === 4 ? prices.perMonth : prices.perWeek * weeks;
  }

  const subtotal = registration + accommodation;
  const processingFee = subtotal * PROCESSING_FEE_PERCENT;
  const total = subtotal + processingFee;
  return {
    registration: registration.toFixed(2),
    accommodation: accommodation.toFixed(2),
    subtotal: subtotal.toFixed(2),
    processingFee: processingFee.toFixed(2),
    total: total.toFixed(2),
    tier,
  };
}

// Create a Mollie payment for an application
async function createPayment(applicationId, ticketType, weeksCount, email, firstName, lastName, accommodationType, selectedWeeks) {
  const pricing = calculateAmount(ticketType, weeksCount, accommodationType);

  const baseUrl = process.env.BASE_URL || 'https://valleyofthecommons.com';

  // Build itemized description
  const parts = [`Registration (${weeksCount} week${weeksCount > 1 ? 's' : ''})`];
  if (accommodationType && ACCOMMODATION_PRICES[accommodationType]) {
    const label = ACCOMMODATION_LABELS[accommodationType] || accommodationType;
    parts.push(`Accommodation: ${label} (${weeksCount} week${weeksCount > 1 ? 's' : ''})`);
  }
  parts.push('incl. 2% processing fee');
  const description = `Valley of the Commons - ${parts.join(' + ')}`;

  const payment = await mollieClient.payments.create({
    amount: {
      currency: 'EUR',
      value: pricing.total,
    },
    description,
    redirectUrl: `${baseUrl}/payment-return.html?id=${applicationId}`,
    webhookUrl: `${baseUrl}/api/mollie/webhook`,
    metadata: {
      applicationId,
      ticketType,
      weeksCount,
      accommodationType: accommodationType || null,
      selectedWeeks: selectedWeeks || [],
      breakdown: pricing,
    },
  });

  // Store Mollie payment ID in database
  await pool.query(
    `UPDATE applications
     SET mollie_payment_id = $1,
         payment_amount = $2,
         payment_status = 'pending'
     WHERE id = $3`,
    [payment.id, pricing.total, applicationId]
  );

  return {
    paymentId: payment.id,
    checkoutUrl: payment.getCheckoutUrl(),
    amount: pricing.total,
    pricing,
  };
}

// Payment confirmation email
const paymentConfirmationEmail = (application, bookingResult) => {
  const accomLabel = application.accommodation_type
    ? (ACCOMMODATION_LABELS[application.accommodation_type] || application.accommodation_type)
    : null;

  // Build accommodation row if applicable
  const accomRow = accomLabel ? `
          <tr>
            <td style="padding: 4px 0;"><strong>Accommodation:</strong></td>
            <td style="padding: 4px 0;">${accomLabel}</td>
          </tr>` : '';

  // Booking assignment info
  let bookingHtml = '';
  if (bookingResult) {
    if (bookingResult.success) {
      bookingHtml = `
      <div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0; color: #2d5016;">Bed Assignment</h3>
        <p style="margin-bottom: 0;">You have been assigned to <strong>${bookingResult.venue} — Room ${bookingResult.room}, ${bookingResult.bedType}</strong>.</p>
      </div>`;
    } else {
      bookingHtml = `
      <div style="background: #fff3e0; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin-bottom: 0;">Your accommodation request has been noted. Our team will follow up with your room assignment shortly.</p>
      </div>`;
    }
  }

  return {
    subject: 'Payment Confirmed - Valley of the Commons',
    html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2d5016; margin-bottom: 24px;">Payment Confirmed!</h1>

      <p>Dear ${application.first_name},</p>

      <p>Your payment of <strong>&euro;${application.payment_amount}</strong> for Valley of the Commons has been received.</p>

      <div style="background: #f5f5f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #2d5016;">Payment Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0;"><strong>Type:</strong></td>
            <td style="padding: 4px 0;">Event Registration${accomLabel ? ' + Accommodation' : ''}</td>
          </tr>
          ${accomRow}
          <tr>
            <td style="padding: 4px 0;"><strong>Amount:</strong></td>
            <td style="padding: 4px 0;">&euro;${application.payment_amount}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Mollie Reference:</strong></td>
            <td style="padding: 4px 0;">${application.mollie_payment_id}</td>
          </tr>
        </table>
      </div>

      ${bookingHtml}

      <p>Your application is now complete. Our team will review it and get back to you within 2-3 weeks.</p>

      <p>If you have any questions, reply to this email and we'll get back to you.</p>

      <p style="margin-top: 32px;">
        With warmth,<br>
        <strong>The Valley of the Commons Team</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">
      <p style="font-size: 12px; color: #666;">
        Application ID: ${application.id}
      </p>
    </div>
  `
  };
};

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

// Webhook handler - called by Mollie when payment status changes
async function handleWebhook(req, res) {
  try {
    const paymentId = req.body.id;
    if (!paymentId) {
      return res.status(400).json({ error: 'Missing payment id' });
    }

    // Fetch payment status from Mollie
    const payment = await mollieClient.payments.get(paymentId);
    const applicationId = payment.metadata.applicationId;

    // Map Mollie status to our status
    let paymentStatus;
    switch (payment.status) {
      case 'paid':
        paymentStatus = 'paid';
        break;
      case 'failed':
        paymentStatus = 'failed';
        break;
      case 'canceled':
        paymentStatus = 'canceled';
        break;
      case 'expired':
        paymentStatus = 'expired';
        break;
      case 'pending':
        paymentStatus = 'pending';
        break;
      case 'open':
        paymentStatus = 'open';
        break;
      default:
        paymentStatus = payment.status;
    }

    // Update application payment status
    await pool.query(
      `UPDATE applications
       SET payment_status = $1::varchar,
           payment_paid_at = CASE WHEN $1::varchar = 'paid' THEN CURRENT_TIMESTAMP ELSE payment_paid_at END
       WHERE mollie_payment_id = $2::varchar`,
      [paymentStatus, paymentId]
    );

    console.log(`Payment ${paymentId} for application ${applicationId}: ${paymentStatus}`);

    // On payment success: assign bed + send confirmation emails
    if (paymentStatus === 'paid') {
      try {
        const appResult = await pool.query(
          'SELECT id, first_name, last_name, email, contribution_amount, payment_amount, mollie_payment_id, accommodation_type FROM applications WHERE mollie_payment_id = $1',
          [paymentId]
        );

        if (appResult.rows.length > 0) {
          const application = appResult.rows[0];
          const accommodationType = payment.metadata.accommodationType || application.accommodation_type;
          const selectedWeeks = payment.metadata.selectedWeeks || [];

          // Attempt bed assignment if accommodation was selected
          let bookingResult = null;
          if (accommodationType) {
            try {
              const guestName = `${application.first_name} ${application.last_name}`;
              bookingResult = await assignBooking(guestName, accommodationType, selectedWeeks);
              console.log(`[Booking] ${guestName}: ${bookingResult.success ? 'Assigned' : 'Failed'} — ${JSON.stringify(bookingResult)}`);
            } catch (bookingError) {
              console.error('[Booking] Assignment error:', bookingError);
              bookingResult = { success: false, reason: bookingError.message };
            }
          }

          // Send payment confirmation email
          if (process.env.SMTP_PASS) {
            const confirmEmail = paymentConfirmationEmail(application, bookingResult);
            const info = await smtp.sendMail({
              from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
              to: application.email,
              bcc: 'team@valleyofthecommons.com',
              subject: confirmEmail.subject,
              html: confirmEmail.html,
            });
            await logEmail(application.email, `${application.first_name} ${application.last_name}`,
              'payment_confirmation', confirmEmail.subject, info.messageId,
              { applicationId: application.id, paymentId, amount: application.payment_amount });

            // Send internal booking notification to team
            if (accommodationType) {
              const accomLabel = ACCOMMODATION_LABELS[accommodationType] || accommodationType;
              const bookingStatus = bookingResult?.success
                ? `Assigned: ${bookingResult.venue} Room ${bookingResult.room} (${bookingResult.bedType})`
                : `MANUAL ASSIGNMENT NEEDED — ${bookingResult?.reason || 'unknown error'}`;

              const bookingNotification = {
                subject: `Booking ${bookingResult?.success ? 'Assigned' : 'NEEDS ATTENTION'}: ${application.first_name} ${application.last_name}`,
                html: `
                  <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: ${bookingResult?.success ? '#2d5016' : '#c53030'};">
                      ${bookingResult?.success ? 'Bed Assigned' : 'Manual Assignment Needed'}
                    </h2>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;"><strong>Guest:</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${application.first_name} ${application.last_name}</td></tr>
                      <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${application.email}</td></tr>
                      <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;"><strong>Accommodation:</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${accomLabel}</td></tr>
                      <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;"><strong>Weeks:</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${selectedWeeks.join(', ') || 'N/A'}</td></tr>
                      <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${bookingStatus}</td></tr>
                      <tr><td style="padding: 6px 0;"><strong>Payment:</strong></td><td style="padding: 6px 0;">&euro;${application.payment_amount}</td></tr>
                    </table>
                  </div>
                `,
              };

              try {
                await smtp.sendMail({
                  from: process.env.EMAIL_FROM || 'Valley of the Commons <contact@valleyofthecommons.com>',
                  to: 'team@valleyofthecommons.com',
                  subject: bookingNotification.subject,
                  html: bookingNotification.html,
                });
              } catch (notifyError) {
                console.error('Failed to send booking notification:', notifyError);
              }
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to process paid webhook:', emailError);
      }
    }

    // Mollie expects a 200 response
    return res.status(200).end();
  } catch (error) {
    console.error('Mollie webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Payment status check endpoint (for frontend polling)
async function getPaymentStatus(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing application id' });
    }

    const result = await pool.query(
      'SELECT payment_status, payment_amount, contribution_amount FROM applications WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = result.rows[0];
    return res.status(200).json({
      paymentStatus: app.payment_status,
      paymentAmount: app.payment_amount,
      ticketType: app.contribution_amount,
      ticketLabel: TICKET_LABELS[app.contribution_amount] || app.contribution_amount,
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return res.status(500).json({ error: 'Failed to check payment status' });
  }
}

module.exports = {
  createPayment, handleWebhook, getPaymentStatus,
  REGISTRATION_PRICING, PROCESSING_FEE_PERCENT,
  ACCOMMODATION_PRICES, ACCOMMODATION_LABELS,
  TICKET_LABELS, calculateAmount, getPricingTier,
};
