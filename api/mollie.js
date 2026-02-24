// Mollie payment integration
// Handles payment creation and webhook callbacks

const { createMollieClient } = require('@mollie/api-client');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

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
    user: process.env.SMTP_USER || 'noreply@jeffemmett.com',
    pass: process.env.SMTP_PASS || '',
  },
  tls: { rejectUnauthorized: false },
});

// Ticket price mapping (in EUR)
const TICKET_PRICES = {
  'full-dorm': 1500.00,
  'full-shared': 1800.00,
  'full-single': 3200.00,
  'week-dorm': 425.00,
  'week-shared': 500.00,
  'week-single': 850.00,
  'no-accom': 300.00, // per week
};

const TICKET_LABELS = {
  'full-dorm': 'Full Resident - Dorm (4-6 people)',
  'full-shared': 'Full Resident - Shared Double',
  'full-single': 'Full Resident - Single (deluxe apartment)',
  'week-dorm': '1-Week Visitor - Dorm (4-6 people)',
  'week-shared': '1-Week Visitor - Shared Double',
  'week-single': '1-Week Visitor - Single (deluxe apartment)',
  'no-accom': 'Non-Accommodation Pass',
};

function calculateAmount(ticketType, weeksCount) {
  const basePrice = TICKET_PRICES[ticketType];
  if (!basePrice) return null;

  // no-accom is priced per week
  if (ticketType === 'no-accom') {
    return (basePrice * (weeksCount || 1)).toFixed(2);
  }

  return basePrice.toFixed(2);
}

// Create a Mollie payment for an application
async function createPayment(applicationId, ticketType, weeksCount, email, firstName, lastName) {
  const amount = calculateAmount(ticketType, weeksCount);
  if (!amount) {
    throw new Error(`Invalid ticket type: ${ticketType}`);
  }

  const baseUrl = process.env.BASE_URL || 'https://valleyofthecommons.com';
  const description = `Valley of the Commons - ${TICKET_LABELS[ticketType] || ticketType}`;

  const payment = await mollieClient.payments.create({
    amount: {
      currency: 'EUR',
      value: amount,
    },
    description,
    redirectUrl: `${baseUrl}/payment-return.html?id=${applicationId}`,
    webhookUrl: `${baseUrl}/api/mollie/webhook`,
    metadata: {
      applicationId,
      ticketType,
      weeksCount,
    },
  });

  // Store Mollie payment ID in database
  await pool.query(
    `UPDATE applications
     SET mollie_payment_id = $1,
         payment_amount = $2,
         payment_status = 'pending'
     WHERE id = $3`,
    [payment.id, amount, applicationId]
  );

  return {
    paymentId: payment.id,
    checkoutUrl: payment.getCheckoutUrl(),
    amount,
  };
}

// Payment confirmation email
const paymentConfirmationEmail = (application) => ({
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
            <td style="padding: 4px 0;"><strong>Ticket:</strong></td>
            <td style="padding: 4px 0;">${TICKET_LABELS[application.contribution_amount] || application.contribution_amount}</td>
          </tr>
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
       SET payment_status = $1,
           payment_paid_at = CASE WHEN $1 = 'paid' THEN CURRENT_TIMESTAMP ELSE payment_paid_at END
       WHERE mollie_payment_id = $2`,
      [paymentStatus, paymentId]
    );

    console.log(`Payment ${paymentId} for application ${applicationId}: ${paymentStatus}`);

    // Send payment confirmation email if payment succeeded
    if (paymentStatus === 'paid' && process.env.SMTP_PASS) {
      try {
        const appResult = await pool.query(
          'SELECT id, first_name, last_name, email, contribution_amount, payment_amount, mollie_payment_id FROM applications WHERE mollie_payment_id = $1',
          [paymentId]
        );

        if (appResult.rows.length > 0) {
          const application = appResult.rows[0];
          const confirmEmail = paymentConfirmationEmail(application);
          const info = await smtp.sendMail({
            from: process.env.EMAIL_FROM || 'Valley of the Commons <noreply@jeffemmett.com>',
            to: application.email,
            subject: confirmEmail.subject,
            html: confirmEmail.html,
          });
          await logEmail(application.email, `${application.first_name} ${application.last_name}`,
            'payment_confirmation', confirmEmail.subject, info.messageId,
            { applicationId: application.id, paymentId, amount: application.payment_amount });
        }
      } catch (emailError) {
        console.error('Failed to send payment confirmation email:', emailError);
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

module.exports = { createPayment, handleWebhook, getPaymentStatus, TICKET_PRICES, TICKET_LABELS, calculateAmount };
