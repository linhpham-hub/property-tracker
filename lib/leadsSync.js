import { readDataRawRows } from "./googleSheets";

function toLeadRow(row) {
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
    synced_at: new Date().toISOString(),
  };
}

// Pulls every row from the Data_raw tab and upserts it into the `leads`
// table, keyed on row_no (the sheet's own row number). Nothing in `leads`
// is ever hand-edited inside the app, so overwriting on every sync is
// safe — there's no in-app data to lose, unlike tag_list/notes on
// properties. Rows without a readable row number are skipped and counted.
export async function syncLeadsFromSheet(supabase) {
  const rows = await readDataRawRows();
  const withRowNo = rows.filter((r) => r.row_no != null);
  const skipped = rows.length - withRowNo.length;

  const batchSize = 500;
  let synced = 0;
  for (let i = 0; i < withRowNo.length; i += batchSize) {
    const batch = withRowNo.slice(i, i + batchSize).map(toLeadRow);
    const { error } = await supabase.from("leads").upsert(batch, { onConflict: "row_no" });
    if (error) throw new Error(error.message);
    synced += batch.length;
  }

  return { synced, skipped, total: rows.length };
}
