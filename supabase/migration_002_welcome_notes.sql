-- ============================================================
-- Migration: add Tag list + 3 Welcome notes to properties
-- Run this in Supabase: SQL Editor > New query > paste > Run
-- Safe to run once — uses IF NOT EXISTS so it won't error if
-- you accidentally run it twice.
-- ============================================================

alter table properties add column if not exists tag_list text;
alter table properties add column if not exists welcome_note_1 text;
alter table properties add column if not exists welcome_note_2 text;
alter table properties add column if not exists welcome_note_3 text;
