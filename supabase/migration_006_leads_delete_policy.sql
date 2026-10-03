-- ============================================================
-- Migration 006: let the lead sync clean up stale rows.
-- Run once in Supabase: Project > SQL Editor > New query > paste all > Run.
--
-- The "Refresh data" sync now removes leads that are no longer in the
-- Data_raw tab (deleted rows, or a lead that was saved before it had a
-- No. and has since been numbered). Owners and editors need delete
-- permission on `leads` for that. Nothing else changes.
-- ============================================================

drop policy if exists "Editors and owners can delete leads" on leads;

create policy "Editors and owners can delete leads"
  on leads for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );
