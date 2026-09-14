import { google } from "googleapis";

// The exact tab name inside your spreadsheet. If you ever rename the tab,
// update this to match.
export const SHEET_NAME = "Property_master";

// Column letters inside Property_master — must match your sheet's layout:
// A=No. B=Property_name C=Address D=Area E=Property_owner F=Owner_number
// G=Property_link H=Propertyguru_Listing Id I=Property_type J=Property_status
// K=remark L=Tag list M=Welcome 1 N=Welcome 2 O=Welcome 3 P=Note 1

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  // .env files can't hold real newlines cleanly, so the key is stored with
  // literal \n sequences — convert them back before using it.
  const key = rawKey.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables."
    );
  }
  return new google.auth.JWT(email, null, key, ["https://www.googleapis.com/auth/spreadsheets"]);
}

async function getSheetsClient() {
  const auth = getAuth();
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function requireSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
  return id;
}

// Reads every row in Property_master and returns it as plain objects,
// including the 1-indexed sheet row number (needed later to write back to
// the correct row).
export async function readSheetRows() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: requireSheetId(),
    range: `${SHEET_NAME}!A2:P5000`,
  });
  const rows = res.data.values || [];
  return rows
    .map((r, i) => ({
      rowNumber: i + 2, // +2: sheet rows are 1-indexed and row 1 is the header
      property_name: (r[1] || "").trim(),
      address: (r[2] || "").trim(),
      area: (r[3] || "").trim(),
      property_owner: (r[4] || "").trim(),
      owner_number: (r[5] || "").trim(),
      property_link: (r[6] || "").trim(),
      listing_id: (r[7] || "").trim(),
      property_type: (r[8] || "").trim(),
      property_status: (r[9] || "").trim(),
      remark: (r[10] || "").trim(),
      tag_list: (r[11] || "").trim(),
      welcome_note_1: (r[12] || "").trim(),
      welcome_note_2: (r[13] || "").trim(),
      welcome_note_3: (r[14] || "").trim(),
      notes: (r[15] || "").trim(),
    }))
    .filter((r) => r.property_name); // skip fully blank rows
}

// Appends a brand-new row for a property just created in the app.
// Only fields the app collects at creation time are written — Welcome
// notes and Notes are left blank for you to fill in later via the app,
// then push with updateSheetRowCells.
export async function appendSheetRow(property) {
  const sheets = await getSheetsClient();
  const row = [
    "", // No. — left blank, not app-managed
    property.property_name || "",
    property.address || "",
    property.area || "",
    property.property_owner || "",
    property.owner_number || "",
    property.property_link || "",
    property.listing_id || "",
    property.property_type || "",
    property.property_status || "",
    "", // remark
    property.tag_list || "",
    "", // Welcome 1
    "", // Welcome 2
    "", // Welcome 3
    "", // Note 1
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: requireSheetId(),
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

// Overwrites only Tag list (L), Welcome 1-3 (M:O), and Note 1 (P) for a
// specific sheet row. Never touches columns A-K, so core listing facts
// maintained in the sheet are never affected by a push from the app.
export async function updateSheetRowCells(rowNumber, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: requireSheetId(),
    range: `${SHEET_NAME}!L${rowNumber}:P${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          values.tag_list || "",
          values.welcome_note_1 || "",
          values.welcome_note_2 || "",
          values.welcome_note_3 || "",
          values.notes || "",
        ],
      ],
    },
  });
}
