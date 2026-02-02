// Vercel serverless function to handle waitlist submissions
// This keeps Google Sheets credentials private (server-side only)

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for frontend access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    // Get credentials from environment variables
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Waitlist';

    if (!credentials || !spreadsheetId) {
      console.error('Missing Google Sheets configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Parse service account credentials
    // Trim whitespace and handle multi-line JSON from environment variable
    const credentialsTrimmed = credentials.trim();
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(credentialsTrimmed);
    } catch (parseError) {
      console.error('Failed to parse service account credentials:', parseError.message);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Import googleapis (will be installed as dependency)
    const { google } = require('googleapis');

    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare the data to append
    const timestamp = new Date().toISOString();
    const values = [[timestamp, email, name || '', involvement || '']];

    // Append to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:D`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values,
      },
    });

    // Success response
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully joined the waitlist!' 
    });

  } catch (error) {
    // Log detailed error for debugging (visible in Vercel logs)
    console.error('Error adding to waitlist:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      details: error.response?.data,
      stack: error.stack
    });
    
    // Provide more specific error messages for common issues
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        error: 'Network error connecting to Google Sheets. Please try again later.' 
      });
    }
    
    if (error.response?.status === 403) {
      console.error('Permission denied - check service account has access to sheet');
      return res.status(500).json({ 
        error: 'Permission error. Please contact support.' 
      });
    }
    
    if (error.response?.status === 404) {
      console.error('Sheet not found - check spreadsheet ID and sheet name');
      return res.status(500).json({ 
        error: 'Sheet configuration error. Please contact support.' 
      });
    }
    
    // Don't expose internal errors to client
    return res.status(500).json({ 
      error: 'Failed to join waitlist. Please try again later.' 
    });
  }
}

