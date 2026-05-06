// ============================================================
// NICO Life Agent PWA — Google Apps Script Webhook
// ============================================================
// HOW TO DEPLOY:
//   1. Go to https://script.google.com → New Project
//   2. Paste this entire file in
//   3. Click Deploy → New Deployment
//   4. Type: Web App
//   5. Execute as: Me
//   6. Who has access: Anyone
//   7. Click Deploy → Copy the Web App URL
//   8. Paste that URL into the app under Profile → Google Sheets Sync
// ============================================================

const SHEET_NAME   = "Quotes";        // Tab name for individual quotes
const SUMMARY_NAME = "Summary";       // Tab name for agent summary
const SPREADSHEET_ID = "";            // ← Optional: paste your Spreadsheet ID here
                                      //   Leave blank to auto-create a new one

// ------------------------------------------------------------
// ENTRY POINT — receives POST from the PWA
// ------------------------------------------------------------
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss      = getOrCreateSpreadsheet();

    if (Array.isArray(payload)) {
      // Bulk sync — array of quotes
      payload.forEach(q => writeQuoteRow(ss, q));
    } else {
      // Single quote
      writeQuoteRow(ss, payload);
    }

    updateSummary(ss);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Also support GET for connection testing from browser
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "NICO Life Agent Webhook is live ✓" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// WRITE A QUOTE ROW
// ------------------------------------------------------------
function writeQuoteRow(ss, quote) {
  const sheet = getOrCreateSheet(ss, SHEET_NAME);

  // Write headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    const headers = [
      "Ref", "Date", "Client Name", "Phone", "Agent",
      "Monthly Premium (MWK)", "Sum Assured (MWK)",
      "3-Year Bonus (MWK)", "Capital Invested (MWK)",
      "Maturity Value - Base (MWK)",
      "Maturity Value - +5% p.a. (MWK)",
      "Maturity Value - +10% p.a. (MWK)",
      "Status", "Notes", "Synced At"
    ];
    const headerRow = sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#0A3FA8")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setFontSize(10);
    sheet.setFrozenRows(1);
  }

  // Check if this ref already exists → update instead of duplicate
  const data      = sheet.getDataRange().getValues();
  const refCol    = 0; // Column A = index 0
  const existRow  = data.findIndex((row, i) => i > 0 && row[refCol] === quote.ref);

  const rowData = [
    quote.ref         || "",
    quote.date        ? new Date(quote.date).toLocaleString("en-GB") : new Date().toLocaleString("en-GB"),
    quote.client      || "",
    quote.phone       || "",
    quote.agent       || "",
    Number(quote.premium       || 0),
    Number(quote.sumAssured    || 0),
    Number(quote.bonus         || 0),
    Number(quote.capital       || 0),
    Number(quote.maturityValue || 0),
    Number(quote.maturity5     || 0),
    Number(quote.maturity10    || 0),
    quote.status      || "draft",
    quote.notes       || "",
    new Date().toLocaleString("en-GB")
  ];

  if (existRow > 0) {
    // Update existing row
    sheet.getRange(existRow + 1, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Append new row
    sheet.appendRow(rowData);
    // Alternate row shading
    const lastRow = sheet.getLastRow();
    if (lastRow % 2 === 0) {
      sheet.getRange(lastRow, 1, 1, rowData.length).setBackground("#EEF2FF");
    }
  }

  // Format currency columns (F through L = columns 6–12)
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 6, 1, 7).setNumberFormat("#,##0.00");

  // Status colour coding
  const statusCell = sheet.getRange(lastRow, 13);
  if (quote.status === "sent") {
    statusCell.setBackground("#D1FAE5").setFontColor("#065F46");
  } else {
    statusCell.setBackground("#FEF3C7").setFontColor("#92400E");
  }

  // Auto-resize columns on first few rows
  if (sheet.getLastRow() <= 5) {
    sheet.autoResizeColumns(1, rowData.length);
  }
}

// ------------------------------------------------------------
// UPDATE SUMMARY TAB
// ------------------------------------------------------------
function updateSummary(ss) {
  const quotesSheet = getOrCreateSheet(ss, SHEET_NAME);
  const summSheet   = getOrCreateSheet(ss, SUMMARY_NAME);
  summSheet.clearContents();

  const data = quotesSheet.getDataRange().getValues();
  if (data.length <= 1) return; // Only headers, nothing to summarise

  const rows = data.slice(1); // Skip header

  const totalQuotes  = rows.length;
  const sentQuotes   = rows.filter(r => r[12] === "sent").length;
  const draftQuotes  = rows.filter(r => r[12] === "draft").length;
  const totalPremium = rows.reduce((s, r) => s + Number(r[5] || 0), 0);
  const avgPremium   = totalQuotes > 0 ? totalPremium / totalQuotes : 0;
  const totalMaturity= rows.reduce((s, r) => s + Number(r[9] || 0), 0);

  // Agent breakdown
  const agentMap = {};
  rows.forEach(r => {
    const agent = r[4] || "Unknown";
    if (!agentMap[agent]) agentMap[agent] = { quotes: 0, sent: 0, premium: 0 };
    agentMap[agent].quotes++;
    if (r[12] === "sent") agentMap[agent].sent++;
    agentMap[agent].premium += Number(r[5] || 0);
  });

  // Write summary
  const title = [["NICO Life Agent — Quotes Summary"]];
  summSheet.getRange(1, 1, 1, 4).merge().setValues(title)
    .setBackground("#0A3FA8").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontSize(14);

  summSheet.getRange(2, 1).setValue("Last Updated: " + new Date().toLocaleString("en-GB"));
  summSheet.getRange(2, 1).setFontStyle("italic").setFontColor("#888888");

  const kpis = [
    ["", ""],
    ["METRIC", "VALUE"],
    ["Total Quotes Generated", totalQuotes],
    ["Quotes Sent to Clients", sentQuotes],
    ["Draft Quotes", draftQuotes],
    ["Total Monthly Premiums", totalPremium],
    ["Average Monthly Premium", avgPremium],
    ["Total Projected Maturity Value", totalMaturity],
    ["", ""],
    ["AGENT BREAKDOWN", ""],
    ["Agent Name", "Quotes | Sent | Avg Premium"],
  ];

  summSheet.getRange(3, 1, kpis.length, 2).setValues(kpis);
  summSheet.getRange(4, 1, 1, 2).setBackground("#E8EDF8").setFontWeight("bold");
  summSheet.getRange(12, 1, 1, 2).setBackground("#E8EDF8").setFontWeight("bold");

  // Format KPI values
  summSheet.getRange(8, 2).setNumberFormat("#,##0.00");
  summSheet.getRange(9, 2).setNumberFormat("#,##0.00");
  summSheet.getRange(10, 2).setNumberFormat("#,##0.00");

  // Agent rows
  let row = 3 + kpis.length;
  Object.entries(agentMap).forEach(([agent, stats]) => {
    summSheet.getRange(row, 1).setValue(agent);
    summSheet.getRange(row, 2).setValue(
      `${stats.quotes} quotes | ${stats.sent} sent | MWK ${stats.premium.toLocaleString()} total`
    );
    row++;
  });

  summSheet.autoResizeColumns(1, 2);
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function getOrCreateSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // Try to find an existing one named "NICO Life Agent Quotes"
  const files = DriveApp.getFilesByName("NICO Life Agent Quotes");
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  // Create a new one
  const ss = SpreadsheetApp.create("NICO Life Agent Quotes");
  Logger.log("Created new spreadsheet: " + ss.getUrl());
  return ss;
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
