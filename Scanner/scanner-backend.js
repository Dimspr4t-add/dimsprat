// Google Apps Script Web App Backend for Ticket Scanner

// Configuration
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', // Replace with your Google Sheet ID
  SHEET_NAME: 'Tickets', // Name of the sheet where tickets are stored
  HEADER_ROW: 1, // Row number of the header row
  TICKET_ID_COL: 'A', // Column letter for Ticket ID
  NAME_COL: 'B',         // Column letter for Attendee Name
  TYPE_COL: 'C',         // Column letter for Ticket Type
  EVENT_COL: 'D',        // Column letter for Event Name
  DATE_COL: 'E',         // Column letter for Event Date
  STATUS_COL: 'F',       // Column letter for Check-in Status
  TIMESTAMP_COL: 'G'     // Column letter for Check-in Timestamp
};

// Web App entry point
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// Handle incoming requests
function handleRequest(e) {
  try {
    const action = e.parameter.action;
    let response;

    switch (action) {
      case 'validateTicket':
        response = validateTicket(e.parameter.ticketId);
        break;
      case 'checkInTicket':
        response = checkInTicket(e.parameter.ticketId);
        break;
      case 'getEventStats':
        response = getEventStats();
        break;
      default:
        response = createResponse(400, { error: 'Invalid action' });
    }

    return response;
  } catch (error) {
    console.error('Error:', error);
    return createResponse(500, { error: 'Internal server error', details: error.toString() });
  }
}

// Validate a ticket
function validateTicket(ticketId) {
  if (!ticketId) {
    return createResponse(400, { error: 'Ticket ID is required' });
  }

  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  // Find column indexes
  const ticketIdCol = headers.indexOf(CONFIG.TICKET_ID_COL.toLowerCase());
  const nameCol = headers.indexOf(CONFIG.NAME_COL.toLowerCase());
  const typeCol = headers.indexOf(CONFIG.TYPE_COL.toLowerCase());
  const eventCol = headers.indexOf(CONFIG.EVENT_COL.toLowerCase());
  const dateCol = headers.indexOf(CONFIG.DATE_COL.toLowerCase());
  const statusCol = headers.indexOf(CONFIG.STATUS_COL.toLowerCase());

  // Find the ticket
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[ticketIdCol] && row[ticketIdCol].toString().trim() === ticketId.trim()) {
      const ticket = {
        ticketId: row[ticketIdCol],
        name: row[nameCol] || '',
        type: row[typeCol] || '',
        event: row[eventCol] || '',
        date: row[dateCol] ? new Date(row[dateCol]).toISOString().split('T')[0] : '',
        status: row[statusCol] || 'Not Checked In',
        isValid: true
      };
      return createResponse(200, ticket);
    }
  }

  return createResponse(404, { error: 'Ticket not found', isValid: false });
}

// Check in a ticket
function checkInTicket(ticketId) {
  if (!ticketId) {
    return createResponse(400, { error: 'Ticket ID is required' });
  }

  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const ticketIdCol = headers.indexOf(CONFIG.TICKET_ID_COL.toLowerCase());
  const statusCol = headers.indexOf(CONFIG.STATUS_COL.toLowerCase());
  const timestampCol = headers.indexOf(CONFIG.TIMESTAMP_COL.toLowerCase());

  // Find and update the ticket
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[ticketIdCol] && row[ticketIdCol].toString().trim() === ticketId.trim()) {
      // Check if already checked in
      if (row[statusCol] && row[statusCol].toString().toLowerCase().includes('checked in')) {
        return createResponse(400, { 
          error: 'Ticket already checked in', 
          alreadyCheckedIn: true,
          checkInTime: row[timestampCol] || 'Unknown'
        });
      }
      
      // Update status and timestamp
      sheet.getRange(i + 1, statusCol + 1).setValue('Checked In');
      sheet.getRange(i + 1, timestampCol + 1).setValue(new Date());
      
      return createResponse(200, { 
        success: true, 
        message: 'Ticket checked in successfully',
        checkInTime: new Date().toISOString()
      });
    }
  }

  return createResponse(404, { error: 'Ticket not found' });
}

// Get event statistics
function getEventStats() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const statusCol = headers.indexOf(CONFIG.STATUS_COL.toLowerCase());
  const typeCol = headers.indexOf(CONFIG.TYPE_COL.toLowerCase());
  
  let totalTickets = data.length - 1; // Exclude header
  let checkedIn = 0;
  const typeCounts = {};
  const typeCheckedIn = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const type = row[typeCol] || 'Unknown';
    const status = (row[statusCol] || '').toString().toLowerCase();
    
    // Count by type
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    
    // Count check-ins
    if (status.includes('checked in')) {
      checkedIn++;
      typeCheckedIn[type] = (typeCheckedIn[type] || 0) + 1;
    }
  }
  
  return createResponse(200, {
    totalTickets,
    checkedIn,
    remaining: totalTickets - checkedIn,
    checkInRate: totalTickets > 0 ? (checkedIn / totalTickets) * 100 : 0,
    byType: Object.keys(typeCounts).map(type => ({
      type,
      total: typeCounts[type],
      checkedIn: typeCheckedIn[type] || 0,
      remaining: typeCounts[type] - (typeCheckedIn[type] || 0)
    }))
  });
}

// Helper function to get the sheet
function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return spreadsheet.getSheetByName(CONFIG.SHEET_NAME) || spreadsheet.getSheets()[0];
}

// Helper function to create consistent responses
function createResponse(statusCode, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setResponseCode(statusCode);
}

// Test function to verify the script is working
function test() {
  console.log('Test function running');
  console.log('Current configuration:', CONFIG);
  
  // Test getting the sheet
  try {
    const sheet = getSheet();
    console.log('Connected to sheet:', sheet.getName());
    
    // Test getting some data
    const data = sheet.getDataRange().getValues();
    console.log(`Found ${data.length - 1} rows of data (excluding header)`);
    
    // Test validation
    if (data.length > 1) {
      const testTicketId = data[1][0]; // First data row, first column
      console.log('Testing validation for ticket:', testTicketId);
      const validation = validateTicket({ parameter: { action: 'validateTicket', ticketId: testTicketId } });
      console.log('Validation result:', JSON.parse(validation.getContent()));
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}
