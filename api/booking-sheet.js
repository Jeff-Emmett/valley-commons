// Booking sheet integration
// Manages bed assignments on a Google Sheets booking sheet
// Ported from CCG's lib/booking-sheet.ts, adapted for week-based columns

const fs = require('fs');

let sheetsClient = null;

// Accommodation criteria mapping — maps accommodation_type to sheet matching rules
const ACCOMMODATION_CRITERIA = {
  'ch-multi': {
    venue: 'Commons Hub',
    bedTypes: ['Bunk up', 'Bunk down', 'Single'],
  },
  'ch-double': {
    venue: 'Commons Hub',
    bedTypes: ['Double'],
  },
  'hh-single': {
    venue: 'Herrnhof Villa',
    bedTypes: ['Single'],
  },
  'hh-double-separate': {
    venue: 'Herrnhof Villa',
    bedTypes: ['Double (separate)', 'Twin'],
  },
  'hh-double-shared': {
    venue: 'Herrnhof Villa',
    bedTypes: ['Double (shared)', 'Double'],
  },
  'hh-triple': {
    venue: 'Herrnhof Villa',
    bedTypes: ['Triple'],
  },
  'hh-daybed': {
    venue: 'Herrnhof Villa',
    bedTypes: ['Daybed', 'Extra bed', 'Sofa bed'],
  },
};

// Week column headers expected in the sheet
const WEEK_COLUMNS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

function getCredentials() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error('[Booking Sheet] Failed to read credentials file:', err.message);
      return null;
    }
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim());
  } catch {
    console.error('[Booking Sheet] Failed to parse service account JSON');
    return null;
  }
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const creds = getCredentials();
  if (!creds) return null;

  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Read and parse the booking sheet.
 * Expected structure per venue section:
 *   Row: "Commons Hub" or "Herrnhof Villa" (venue header)
 *   Row: Room | Bed Type | Week 1 | Week 2 | Week 3 | Week 4 (column headers)
 *   Row: 5   | Bunk up  |        |        |        |         (bed rows)
 *   ...
 *   Empty row (section separator)
 *
 * Returns array of bed objects:
 *   { venue, room, bedType, rowIndex, weekColumns: { 'Week 1': colIndex, ... }, occupancy: { 'Week 1': 'Guest Name' | null, ... } }
 */
async function parseBookingSheet() {
  const sheets = await getSheetsClient();
  if (!sheets) {
    console.log('[Booking Sheet] No credentials configured — skipping');
    return null;
  }

  const sheetId = process.env.BOOKING_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.BOOKING_SHEET_TAB || 'Booking Sheet';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:G`,
  });

  const rows = response.data.values || [];
  const beds = [];
  let currentVenue = null;
  let weekColIndexes = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(cell => !cell || !cell.toString().trim())) {
      // Empty row — reset venue context
      currentVenue = null;
      weekColIndexes = {};
      continue;
    }

    const firstCell = (row[0] || '').toString().trim();

    // Check if this is a venue header
    if (firstCell === 'Commons Hub' || firstCell === 'Herrnhof Villa') {
      currentVenue = firstCell;
      weekColIndexes = {};
      continue;
    }

    // Check if this is the column header row (contains "Room" and week columns)
    if (firstCell.toLowerCase() === 'room' && currentVenue) {
      for (let c = 0; c < row.length; c++) {
        const header = (row[c] || '').toString().trim();
        if (WEEK_COLUMNS.includes(header)) {
          weekColIndexes[header] = c;
        }
      }
      continue;
    }

    // If we have a venue and week columns, this is a bed row
    if (currentVenue && Object.keys(weekColIndexes).length > 0 && firstCell) {
      const room = firstCell;
      const bedType = (row[1] || '').toString().trim();
      if (!bedType) continue;

      const occupancy = {};
      for (const [week, colIdx] of Object.entries(weekColIndexes)) {
        const cellValue = (row[colIdx] || '').toString().trim();
        occupancy[week] = cellValue || null;
      }

      beds.push({
        venue: currentVenue,
        room,
        bedType,
        rowIndex: i,
        weekColumns: { ...weekColIndexes },
        occupancy,
      });
    }
  }

  return beds;
}

/**
 * Find an available bed matching the accommodation criteria for the given weeks.
 * A bed is "available" only if ALL requested week columns are empty.
 */
function findAvailableBed(beds, accommodationType, selectedWeeks) {
  const criteria = ACCOMMODATION_CRITERIA[accommodationType];
  if (!criteria) {
    console.error(`[Booking Sheet] Unknown accommodation type: ${accommodationType}`);
    return null;
  }

  // Map week values (week1, week2, etc.) to column headers (Week 1, Week 2, etc.)
  const weekHeaders = selectedWeeks.map(w => {
    const num = w.replace('week', '');
    return `Week ${num}`;
  });

  for (const bed of beds) {
    // Match venue
    if (bed.venue !== criteria.venue) continue;

    // Match bed type (case-insensitive partial match)
    const bedTypeLower = bed.bedType.toLowerCase();
    const matchesBedType = criteria.bedTypes.some(bt => bedTypeLower.includes(bt.toLowerCase()));
    if (!matchesBedType) continue;

    // Check all requested weeks are empty
    const allWeeksAvailable = weekHeaders.every(wh => !bed.occupancy[wh]);
    if (!allWeeksAvailable) continue;

    return bed;
  }

  return null;
}

/**
 * Assign a guest to a bed on the booking sheet.
 * Writes guest name to the selected week columns for the matched bed row.
 *
 * @param {string} guestName - Full name of the guest
 * @param {string} accommodationType - e.g. 'ch-multi', 'hh-single'
 * @param {string[]} selectedWeeks - e.g. ['week1', 'week2', 'week3']
 * @returns {object} Result with success status, venue, room, bedType
 */
async function assignBooking(guestName, accommodationType, selectedWeeks) {
  if (!accommodationType || !selectedWeeks || selectedWeeks.length === 0) {
    return { success: false, reason: 'Missing accommodation type or weeks' };
  }

  try {
    const beds = await parseBookingSheet();
    if (!beds) {
      return { success: false, reason: 'Booking sheet not configured' };
    }

    const bed = findAvailableBed(beds, accommodationType, selectedWeeks);
    if (!bed) {
      console.warn(`[Booking Sheet] No available bed for ${accommodationType}, weeks: ${selectedWeeks.join(', ')}`);
      return { success: false, reason: 'No available bed matching criteria' };
    }

    // Write guest name to the selected week columns
    const sheets = await getSheetsClient();
    const sheetId = process.env.BOOKING_SHEET_ID || process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.BOOKING_SHEET_TAB || 'Booking Sheet';

    // Convert week values to column headers
    const weekHeaders = selectedWeeks.map(w => `Week ${w.replace('week', '')}`);

    // Build batch update data
    const data = weekHeaders
      .filter(wh => bed.weekColumns[wh] !== undefined)
      .map(wh => {
        const col = bed.weekColumns[wh];
        const colLetter = String.fromCharCode(65 + col); // A=0, B=1, ...
        const rowNum = bed.rowIndex + 1; // Sheets is 1-indexed
        return {
          range: `${sheetName}!${colLetter}${rowNum}`,
          values: [[guestName]],
        };
      });

    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data,
        },
      });
    }

    console.log(`[Booking Sheet] Assigned ${guestName} to ${bed.venue} Room ${bed.room} (${bed.bedType}) for weeks: ${selectedWeeks.join(', ')}`);

    return {
      success: true,
      venue: bed.venue,
      room: bed.room,
      bedType: bed.bedType,
    };
  } catch (error) {
    console.error('[Booking Sheet] Assignment failed:', error);
    return { success: false, reason: error.message };
  }
}

module.exports = { assignBooking, parseBookingSheet, findAvailableBed, ACCOMMODATION_CRITERIA };
