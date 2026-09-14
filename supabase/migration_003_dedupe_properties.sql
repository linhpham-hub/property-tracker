-- ============================================================
-- One-time cleanup: remove duplicate properties created by the
-- Sync from Sheet bug (keeps the earliest copy of each name —
-- i.e. your original correctly-imported data — deletes the rest)
-- ============================================================

-- Preview first: see what would be deleted before actually deleting
select a.id, a.property_name, a.tag_list, a.created_at
from properties a
join properties b
  on a.property_name = b.property_name
  and a.created_at > b.created_at
order by a.property_name;

-- If that list looks right (duplicates, mostly blank tag_list), run this:
delete from properties a
using properties b
where a.property_name = b.property_name
  and a.created_at > b.created_at;

-- ============================================================
-- Safeguard: prevent this from ever silently duplicating again.
-- Property names are unique in your sheet by design (e.g. the
-- _1/_2/_3 suffixes), so this constraint is safe to add.
-- ============================================================
create unique index if not exists properties_property_name_unique
  on properties (property_name);
