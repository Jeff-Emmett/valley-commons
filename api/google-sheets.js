// Google Sheets sync helper
// Non-blocking secondary write for team access and redundancy
// Reads credentials from file (GOOGLE_SERVICE_ACCOUNT_FILE) or env var (GOOGLE_SERVICE_ACCOUNT)

const fs = require('fs');

let sheetsClient = null;
let authClient = null;

function getCredentials() {
  if (!process.env.GOOGLE_SHEET_ID) return null;

  // Prefer file-based credentials (cleaner for Docker)
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error('[Google Sheets] Failed to read credentials file:', err.message);
      return null;
    }
  }

  // Fall back to JSON string in env var
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim());
  } catch {
    console.error('[Google Sheets] Failed to parse service account JSON');
    return null;
  }
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const creds = getCredentials();
  if (!creds) return null;

  const { google } = require('googleapis');
  authClient = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

/**
 * Append a row to a specific sheet tab.
 * Non-blocking — logs errors but never throws.
 */
async function appendRow(sheetName, values) {
  try {
    const sheets = await getSheetsClient();
    if (!sheets) {
      console.log('[Google Sheets] Skipping sync — no credentials configured');
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [values] },
    });

    console.log(`[Google Sheets] Synced row to "${sheetName}"`);
  } catch (error) {
    console.error(`[Google Sheets] Failed to sync to "${sheetName}":`, error.message);
  }
}

/**
 * Sync a waitlist signup to the "Waitlist" sheet tab.
 * Columns: Timestamp | Email | Name | Involvement
 */
function syncWaitlistSignup({ email, name, involvement }) {
  // Fire and forget — don't await in the request handler
  appendRow('Waitlist', [
    new Date().toISOString(),
    email,
    name,
    involvement || '',
  ]);
}

/**
 * Sync an application to the "Registrations" sheet tab.
 * Columns: Timestamp | App ID | Status | First Name | Last Name | Email | Phone |
 *          Country | City | Attendance | Motivation | Contribution | How Heard |
 *          Referral | Scholarship | Scholarship Reason | Weeks/Dates
 */
function syncApplication(app) {
  appendRow('Registrations', [
    new Date().toISOString(),
    app.id || '',
    'pending',
    app.first_name || '',
    app.last_name || '',
    app.email || '',
    app.phone || '',
    app.country || '',
    app.city || '',
    app.attendance_type || '',
    app.motivation || '',
    app.contribution || '',
    app.how_heard || '',
    app.referral_name || '',
    app.scholarship_needed ? 'Yes' : 'No',
    app.scholarship_reason || '',
    app.arrival_date && app.departure_date
      ? `${app.arrival_date} to ${app.departure_date}`
      : '',
  ]);
}

module.exports = { syncWaitlistSignup, syncApplication };
