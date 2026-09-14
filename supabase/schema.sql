-- ============================================================
-- Property Tracker - Supabase schema
-- Run this ONCE in Supabase: Project > SQL Editor > New query > paste all > Run
-- ============================================================

-- 1. Profiles table: one row per signed-up user, tracks their permission level
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Signed-in users can view all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own display name"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile (defaulting to 'viewer') whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, new.email, 'viewer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Properties table - one row per property, matches your spreadsheet columns
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  no text,
  property_name text not null,
  address text,
  area text,
  district text,
  property_owner text,
  owner_number text,
  property_link text,
  listing_id text,
  property_type text,
  property_status text,
  price_or_rent text,
  beds text,
  baths text,
  size_sqft text,
  psf text,
  tenure text,
  top_year text,
  furnishing text,
  nearest_mrt text,
  notes text,
  notes_updated_at timestamptz,
  tag_list text,
  welcome_note_1 text,
  welcome_note_2 text,
  welcome_note_3 text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table properties enable row level security;

create policy "Signed-in users can view properties"
  on properties for select
  to authenticated
  using (true);

create policy "Editors and owners can add properties"
  on properties for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

create policy "Editors and owners can update properties"
  on properties for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

create policy "Only owners can delete properties"
  on properties for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists properties_updated_at on properties;
create trigger properties_updated_at
  before update on properties
  for each row execute procedure public.set_updated_at();

-- 3. Media table - photos and videos attached to a property
create table if not exists property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  url text not null,
  caption text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now()
);

alter table property_media enable row level security;

create policy "Signed-in users can view media"
  on property_media for select
  to authenticated
  using (true);

create policy "Editors and owners can add media"
  on property_media for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

create policy "Editors and owners can delete media"
  on property_media for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

-- 4. Storage bucket for photo/video files, plus access policies
insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do nothing;

create policy "Signed-in users can view files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'property-media');

create policy "Editors and owners can upload files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-media'
    and exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );

create policy "Editors and owners can delete files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-media'
    and exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'editor'))
  );
