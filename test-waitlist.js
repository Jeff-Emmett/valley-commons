// Test script for waitlist API
// Run with: node test-waitlist.js
// Make sure .env file exists with your credentials

require('dotenv').config();
const { google } = require('googleapis');

async function testWaitlist() {
  console.log('🧪 Testing Google Sheets Waitlist Integration...\n');

  // Check environment variables
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Waitlist';

  console.log('📋 Configuration Check:');
  console.log('  ✓ GOOGLE_SERVICE_ACCOUNT:', credentials ? `Set (${credentials.length} chars)` : '❌ MISSING');
  console.log('  ✓ GOOGLE_SHEET_ID:', spreadsheetId || '❌ MISSING');
  console.log('  ✓ GOOGLE_SHEET_NAME:', sheetName);
  console.log('');

  if (!credentials || !spreadsheetId) {
    console.error('❌ Missing required environment variables!');
    console.error('   Create a .env file with GOOGLE_SERVICE_ACCOUNT and GOOGLE_SHEET_ID');
    process.exit(1);
  }

  try {
    // Parse credentials
    console.log('🔐 Parsing credentials...');
    const credentialsTrimmed = credentials.trim();
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(credentialsTrimmed);
      console.log('  ✓ Credentials parsed successfully');
      console.log('  ✓ Service account email:', serviceAccount.client_email);
    } catch (parseError) {
      console.error('  ❌ Failed to parse credentials:', parseError.message);
      process.exit(1);
    }

    // Authenticate
    console.log('\n🔑 Authenticating with Google...');
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log('  ✓ Authentication successful');

    // Get sheets client
    const sheets = google.sheets({ version: 'v4', auth });

    // Test 1: Get spreadsheet metadata
    console.log('\n📊 Test 1: Checking spreadsheet access...');
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      console.log('  ✓ Spreadsheet found:', spreadsheet.data.properties.title);
      console.log('  ✓ Spreadsheet ID:', spreadsheetId);
    } catch (error) {
      console.error('  ❌ Cannot access spreadsheet:', error.message);
      if (error.code === 403) {
        console.error('     → Permission denied. Make sure the service account email has Editor access to the sheet.');
        console.error('     → Service account email:', serviceAccount.client_email);
      } else if (error.code === 404) {
        console.error('     → Spreadsheet not found. Check the GOOGLE_SHEET_ID.');
      }
      process.exit(1);
    }

    // Test 2: Check if sheet tab exists
    console.log('\n📑 Test 2: Checking sheet tab...');
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      const sheetTabs = spreadsheet.data.sheets.map(s => s.properties.title);
      console.log('  ✓ Available sheet tabs:', sheetTabs.join(', '));
      
      if (!sheetTabs.includes(sheetName)) {
        console.error(`  ❌ Sheet tab "${sheetName}" not found!`);
        console.error('     → Available tabs:', sheetTabs.join(', '));
        console.error('     → Update GOOGLE_SHEET_NAME or create a tab named "' + sheetName + '"');
        process.exit(1);
      }
      console.log(`  ✓ Sheet tab "${sheetName}" exists`);
    } catch (error) {
      console.error('  ❌ Error checking sheet tabs:', error.message);
      process.exit(1);
    }

    // Test 3: Try to read from the sheet
    console.log('\n📖 Test 3: Reading from sheet...');
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:C10`,
      });
      console.log('  ✓ Can read from sheet');
      if (response.data.values) {
        console.log('  ✓ Current rows:', response.data.values.length);
      }
    } catch (error) {
      console.error('  ❌ Cannot read from sheet:', error.message);
      process.exit(1);
    }

    // Test 4: Try to append a test row
    console.log('\n✍️  Test 4: Testing write access...');
    try {
      const testTimestamp = new Date().toISOString();
      const testEmail = 'test@example.com';
      const testName = 'Test User';
      const values = [[testTimestamp, testEmail, testName]];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:C`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values,
        },
      });
      console.log('  ✓ Successfully wrote test row to sheet');
      console.log('  ✓ Check your Google Sheet - you should see a test entry');
    } catch (error) {
      console.error('  ❌ Cannot write to sheet:', error.message);
      if (error.response?.status === 403) {
        console.error('     → Permission denied. Service account needs Editor access.');
      }
      process.exit(1);
    }

    console.log('\n✅ All tests passed! Your configuration is correct.');
    console.log('\n💡 Next steps:');
    console.log('   1. Make sure these same values are set in Vercel environment variables');
    console.log('   2. Deploy to Vercel');
    console.log('   3. Test the form on your live site');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testWaitlist();

