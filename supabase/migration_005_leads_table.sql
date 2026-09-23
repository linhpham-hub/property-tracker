-- ============================================================
-- Migration 005: leads table, for the new dashboard.
-- Run once in Supabase: Project > SQL Editor > New query > paste all > Run.
--
-- Holds one row per lead/enquiry, synced from the "Data_raw" tab of your
-- Google Sheet. Nothing in this table is hand-edited inside the app — it
-- is only ever written by the sync routes — so a sync safely overwrites
-- a row when the sheet changes.
-- ============================================================

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  row_no integer unique,
  source_data text,
  enquiry_date date,
  full_name text,
  last_name text,
  first_name text,
  mobile text,
  email text,
  tag text,
  property_name text,
  property_link text,
  listing_id text,
  intent text,
  lead_source text,
  type_of_lead text,
  enquirer_type text,
  property_type text,
  property_status text,
  customer_status text,
  customer_status_reason text,
  note text,
  synced_at timestamptz default now()
);

alter table leads enable row level security;

create policy "Signed-in users can view leads"
  on leads for select
  to authenticated
  using (true);

create policy "Editors and owners can write leads"
  on leads for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

create policy "Editors and owners can update leads"
  on leads for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

create index if not exists leads_enquiry_date_idx on leads (enquiry_date);
create index if not exists leads_customer_status_idx on leads (customer_status);

-- Note: the daily cron sync (pages/api/leads/cron-sync.js) writes with the
-- Supabase service-role key, which bypasses RLS entirely — the two insert/
-- update policies above only govern the in-app "Refresh data" button.
