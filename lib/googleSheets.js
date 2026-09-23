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

// The Data_raw tab: one row per lead/enquiry. Columns (0-indexed):
// A=No. B=Source_data C=Enquiry_date D=Full name E=Last name F=First_name
// G=Mobile H=Email I=Tag J=Property_name K=Property_link L=Listing Id
// M=Intent N=Lead source O=Type of Lead P=Enquirer Type Q=Count R=Countif
// S=Filter_last_update_lead T=Property_type U=Property_status
// V=Customer_status W=Customer_status_reason X=Note
// Q/R/S are Excel helper-formula columns and are intentionally skipped.
export const DATA_RAW_SHEET_NAME = "Data_raw";

// Enquiry_date usually comes back as a real Sheets date (an UNFORMATTED_VALUE
// serial number), but rows pasted in from an export or typed by hand can
// land in the cell as plain text instead — a real date cell reads as a
// number, so anything else silently became `null` before, which quietly
// dropped that row out of every month/year filter (it only ever showed up
// under "All time", never under the month it actually happened in — the
// likely explanation if a specific month looks far short of what the sheet
// actually has). This now also accepts common text date formats so those
// rows aren't lost.
function parseEnquiryDate(raw) {
  if (typeof raw === "number" && raw > 0) {
    // Excel/Sheets day-0 is 1899-12-30.
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;

    // Already ISO-ish: 2026-08-15
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const [, y, mo, da] = m;
      return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
    }

    // The sheet's own display format for this column: M/D/YYYY (US-style).
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, mo, da, y] = m;
      const mm = Number(mo);
      const dd = Number(da);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      }
    }

    // Last resort — only trust it if JS can make sense of it.
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

export async function readDataRawRows() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: requireSheetId(),
    range: `${DATA_RAW_SHEET_NAME}!A2:X6000`,
    // UNFORMATTED_VALUE so a genuine date cell comes back as its raw
    // serial number (locale-proof) rather than a display string — text
    // cells still come through as strings, which parseEnquiryDate also
    // handles (see above).
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values || [];

  return rows
    .map((r, i) => {
      const get = (idx) => {
        const v = r[idx];
        return v === undefined || v === null ? "" : String(v).trim();
      };
      const rowNoRaw = get(0);
      const row_no = rowNoRaw ? Math.round(Number(rowNoRaw)) : null;

      const enquiry_date = parseEnquiryDate(r[2]);

      return {
        row_no: Number.isFinite(row_no) ? row_no : null,
        source_data: get(1),
        enquiry_date,
        full_name: get(3),
        last_name: get(4),
        first_name: get(5),
        mobile: get(6),
        email: get(7),
        tag: get(8),
        property_name: get(9),
        property_link: get(10),
        listing_id: get(11),
        intent: get(12),
        lead_source: get(13),
        type_of_lead: get(14),
        enquirer_type: get(15),
        property_type: get(19),
        property_status: get(20),
        customer_status: get(21),
        customer_status_reason: get(22),
        note: get(23),
      };
    })
    .filter((r) => r.mobile || r.email || r.property_name || r.full_name);
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
