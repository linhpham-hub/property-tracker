import { readDataRawRows } from "./googleSheets";

function toLeadRow(row, syncedAt) {
  return {
    row_no: row.row_no,
    source_data: row.source_data || null,
    enquiry_date: row.enquiry_date,
    full_name: row.full_name || null,
    last_name: row.last_name || null,
    first_name: row.first_name || null,
    mobile: row.mobile || null,
    email: row.email || null,
    tag: row.tag || null,
    property_name: row.property_name || null,
    property_link: row.property_link || null,
    listing_id: row.listing_id || null,
    intent: row.intent || null,
    lead_source: row.lead_source || null,
    type_of_lead: row.type_of_lead || null,
    enquirer_type: row.enquirer_type || null,
    property_type: row.property_type || null,
    property_status: row.property_status || null,
    customer_status: row.customer_status || null,
    customer_status_reason: row.customer_status_reason || null,
    note: row.note || null,
    synced_at: syncedAt,
  };
}

// Pulls every row from the Data_raw tab and upserts it into the `leads`
// table, keyed on row_no (the sheet's own "No." column). Nothing in
// `leads` is ever hand-edited inside the app, so overwriting on every
// sync is safe — there's no in-app data to lose.
export async function syncLeadsFromSheet(supabase) {
  const rows = await readDataRawRows();
  const runStartedAt = new Date().toISOString();

  // "No." is typed by hand: new rows are often left blank, and the same
  // number can appear twice (a row copied down). Both used to break things —
  // blank-No. rows were silently skipped (e.g. 17A Dalhousie Lane on 1 Oct),
  // and a repeat made Postgres reject the whole batch. Now every lead is
  // kept: the first use of a No. keeps it, and blank or repeated ones get a
  // stand-in key (minus the sheet row number, which can't clash with a
  // real No.). Blank and repeated numbers are reported back.
  const seen = new Set();
  const repeatedNos = [];
  let blankNo = 0;
  const keyed = rows.map((r) => {
    if (r.row_no == null) {
      blankNo++;
      return { ...r, row_no: -r.sheet_row };
    }
    if (!seen.has(r.row_no)) {
      seen.add(r.row_no);
      return r;
    }
    repeatedNos.push(r.row_no);
    return { ...r, row_no: -r.sheet_row };
  });

  const batchSize = 500;
  let synced = 0;
  for (let i = 0; i < keyed.length; i += batchSize) {
    const slice = keyed.slice(i, i + batchSize);
    const { error } = await supabase
      .from("leads")
      .upsert(slice.map((r) => toLeadRow(r, runStartedAt)), { onConflict: "row_no" });
    if (error) {
      const first = slice[0].sheet_row;
      const last = slice[slice.length - 1].sheet_row;
      console.error(`leads sync failed on sheet rows ${first}-${last}:`, error);
      throw new Error(`${error.message} (while saving sheet rows ${first}–${last})`);
    }
    synced += slice.length;
  }

  // Only after every batch succeeded: remove rows this run didn't write —
  // leads deleted from the sheet, or a blank-No. lead that has since been
  // given a real No. (it was saved under its stand-in key last time).
  // Without this they'd linger and be double-counted. Needs the delete
  // permission from migration_006; without it this quietly removes nothing.
  const { error: cleanupError, count: removed } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .lt("synced_at", runStartedAt);
  if (cleanupError) console.error("leads cleanup failed:", cleanupError);

  return {
    synced,
    skipped: 0,
    blankNo,
    removed: removed || 0,
    total: rows.length,
    repeatedNos: Array.from(new Set(repeatedNos)),
  };
}
