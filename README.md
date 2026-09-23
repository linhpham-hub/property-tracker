# Property Tracker

A private web app for tracking properties: full details, photos, videos, and
running notes per property. You (owner) and editors can add/edit; other
people you invite start as view-only until you upgrade them.

Built with Next.js + Supabase (free tier covers this comfortably). No
monthly cost unless your usage grows a lot.

---

## Part 1 — Create your Supabase project (the database)

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**. Pick any name (e.g. "property-tracker"), set a
   database password (save it somewhere), choose the region closest to
   Singapore (e.g. Singapore itself, `ap-southeast-1`), and create it.
   Takes about 2 minutes to spin up.
3. Once it's ready, go to the **SQL Editor** (left sidebar) → **New query**.
4. Open the file `supabase/schema.sql` from this project, copy everything,
   paste it into the SQL editor, and click **Run**.
   - This creates all your tables, sets up permissions, and creates the
     storage bucket for photos/videos.
5. Go to **Storage** (left sidebar) and confirm you see a bucket called
   `property-media`. If for any reason it's not there, create it manually
   (name: `property-media`, toggle "Public bucket" on).
6. Go to **Settings → API**. You'll need two values from this page in a
   moment: **Project URL** and the **anon / public** key.

---

## Part 2 — Run the app on your computer

1. Install [Node.js](https://nodejs.org) if you don't have it (the LTS version).
2. Open a terminal in this project folder.
3. Copy the environment file and fill it in:
   ```
   cp .env.local.example .env.local
   ```
   Open `.env.local` in any text editor and paste in your Project URL and
   anon key from Part 1, step 6.
4. Install dependencies:
   ```
   npm install
   ```
5. Run it locally:
   ```
   npm run dev
   ```
6. Open **http://localhost:3000** in your browser.

---

## Part 3 — First sign-in and becoming the owner

1. On the login screen, enter your own email and click **Send sign-in
   link**.
2. Check your inbox, click the link — it'll bring you back to the app,
   signed in. At this point you're a **viewer** by default (everyone starts
   this way, including you).
3. Go back to Supabase → **Table Editor** → `profiles` table. Find the row
   with your email, and change its `role` value from `viewer` to `owner`.
   Save.
4. Refresh the app — you now have full owner access (add, edit, delete,
   invite).

---

## Part 4 — Import your existing spreadsheet

1. In the app, click **Import CSV** (top right, only visible to
   owner/editor).
2. Upload your tracker spreadsheet exported as `.csv`, or the
   `propertyguru_enriched.csv` file from the scraper script.
3. It automatically recognizes common column names (Property_name,
   Address, Area, Owner_number, Property_link, Propertyguru_Listing Id,
   Property_type, Property_status, price/psf/beds/baths/etc. from the
   scraper). Anything it doesn't recognize is just skipped — nothing bad
   happens.
4. Preview the first 10 rows, then click **Import**.
5. Add photos, videos, and notes to individual properties from their detail
   pages afterward.

---

## Part 5 — Put it online so Javier (and others) can access it

The easiest free host for a Next.js app is **Vercel** (made by the same
people, zero-config).

1. Push this project to a GitHub repository:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Create a new empty repo on [github.com](https://github.com/new), then:
   ```
   git remote add origin https://github.com/YOUR-USERNAME/property-tracker.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com), sign up with your GitHub account,
   click **Add New → Project**, and import the repo you just pushed.
3. Before deploying, add your environment variables (same two from
   `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. In about a minute you'll get a live URL like
   `property-tracker-yourname.vercel.app`.
5. Share that URL with Javier or anyone else. When they sign in with their
   email, they're automatically a **viewer** — they can look but not edit,
   exactly as you wanted.

---

## Part 6 — Giving someone edit access later

Whenever you want to upgrade someone (e.g. Javier) from viewer to editor:

1. Supabase → **Table Editor** → `profiles` table.
2. Find their row (by email), change `role` to `editor`.
3. That's it — next time they load the app, they can add/edit properties
   and upload photos/videos, but still can't delete properties (only the
   `owner` role can delete).

There's no in-app admin screen for this on purpose, to keep the build
simple — the Supabase table editor is quick enough for how often you'll
need it.

---

## Part 7 — Google Sheets sync (optional)

**Important — check this first:** the sync only works reliably with a genuine Google Sheet, not
an uploaded `.xlsx` file sitting in Drive. If your spreadsheet was originally an Excel file
(check: does the title bar say "Excel" or is the file icon green with an X?), convert it first:
open it, then **File → Save as Google Sheets** — this creates a true native copy. Use *that* new
file's URL for `GOOGLE_SHEET_ID` below. Skipping this step is what causes duplicate properties and
blank Tag lists — the Sheets API can't reliably read row/column positions from a non-native file.

This connects the app to your `Property_master` tab, three ways:

- **Add a property in the app** → it's automatically appended as a new row in the sheet
- **"↓ Sync from Sheet"** button (dashboard) → pulls in any properties added/edited directly in the
  sheet (Name, Address, Area, Owner, Owner number, Listing link, Listing ID, Type, Status only)
- **"↑ Sync Tag list & Notes to Sheet"** button (each property's page) → pushes that property's Tag
  list, Welcome notes, and Notes into the matching row's columns in the sheet

Photos and videos never touch the sheet (there's nowhere sensible to put them). Notes/Welcome
notes/Tag list are never pulled back down from the sheet automatically — only pushed up when you
click the button — so editing them in the app is always safe.

### Setup (one-time, ~10 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a new project (or
   use an existing one) — name doesn't matter, e.g. "property-tracker".
2. In the search bar, find **"Google Sheets API"** and click **Enable**.
3. In the left sidebar: **IAM & Admin → Service Accounts → Create Service Account**. Name it
   anything (e.g. "sheets-sync"), skip the optional permission steps, click **Done**.
4. Click into the service account you just created → **Keys** tab → **Add Key → Create new key
   → JSON**. This downloads a `.json` file — keep it safe, it's effectively a password.
5. Open that JSON file in a text editor. You need two values from it:
   - `client_email` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is your `GOOGLE_PRIVATE_KEY` (copy the whole thing, including
     `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`, exactly as it appears with
     the `\n` characters — don't try to reformat it)
6. **Share your Google Sheet** with the service account: open `PA_data_master`, click **Share**,
   paste in the `client_email` address from step 5, give it **Editor** access, send.
7. Get your **Sheet ID**: it's the long string in the sheet's URL, between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_YOUR_SHEET_ID/edit
   ```
8. Add all three values to your `.env.local`:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=sheets-sync@your-project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID=1D1kqZcQzEAvboJvTwdynPbX7JsRZWuj6
   ```
9. Restart the app (`Ctrl+C` then `npm run dev` again) so it picks up the new variables.
10. When you deploy to Vercel (Part 5), add these same three variables there too — Vercel's
    environment variables screen handles multi-line values fine, just paste the private key in as
    one block.

### If something goes wrong

- **"Missing GOOGLE_SERVICE_ACCOUNT_EMAIL..."** — the env vars aren't set or the app wasn't
  restarted after adding them.
- **"Could not read the Google Sheet"** — usually means the sheet wasn't shared with the service
  account email, or the tab isn't named exactly `Property_master`.
- **Sync from Sheet takes a while** — with ~100 properties this can take up to a minute; it's
  checking each row against the database one at a time. That's expected.
- **Seeing duplicate properties, or Tag lists that went blank** — this happens if Sync from Sheet
  ran against a non-native `.xlsx` file (see the warning at the top of this section). Convert the
  file to a real Google Sheet, then run `supabase/migration_003_dedupe_properties.sql` once in the
  Supabase SQL Editor to clean up the duplicates it created.
- If you'd rather not set any of this up, everything else in the app works fine without it — the
  Import CSV page (Part 4) is always there as a manual alternative.

---

## Part 8 — Lead dashboard (optional)

Visual overview of the **Data_raw** tab (leads/enquiries), separate from `Property_master`. Total
leads, weekly volume trend, pipeline stage breakdown, property-type interest, lead channel, and
top drop reasons.

**This depends on the same Google Sheet as Part 7**, so it has the exact same requirement: the
file must be a genuine Google Sheet, not an uploaded `.xlsx`. If you haven't done **File → Save as
Google Sheets** yet (see Part 7's warning), do that first — otherwise the dashboard will either
fail to load data or show stale/wrong numbers, the same way the old sync bug did.

1. Run `supabase/migration_005_leads_table.sql` once in the Supabase SQL Editor — creates the
   `leads` table.
2. Everything from Part 7's setup (service account, sheet sharing, `GOOGLE_SHEET_ID`) is reused —
   no new Google Cloud setup needed.
3. Open **Dashboard** in the nav. Owners/editors see a **↻ Refresh data** button — click it to pull
   the latest Data_raw rows on demand. Viewers can see the dashboard but not refresh it.
4. **Daily auto-refresh (optional):** the app also ships a scheduled job (`vercel.json`, calling
   `/api/leads/cron-sync` once a day at 22:00 UTC / 6am Singapore time) so the dashboard stays
   current even if nobody clicks Refresh. To turn it on:
   - In Supabase: **Project Settings → API → service_role key** (not the anon key) — copy it.
   - Make up any long random string for `CRON_SECRET` (e.g. a password generator).
   - Add both `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` to Vercel's environment variables and
     redeploy. Vercel automatically calls the cron endpoint with `CRON_SECRET`, no extra wiring
     needed.
   - If you'd rather not set this up, the manual Refresh button works fine on its own — the cron
     job simply won't run without these two variables, and nothing else breaks.
   - Vercel's free (Hobby) plan allows cron jobs that run once a day, which is exactly what this
     uses.
5. Want a different refresh time? Edit the `schedule` in `vercel.json` (cron syntax, in UTC).

---

## What each part of the app does

- **Dashboard** (`/`) — searchable, filterable grid of every property.
  Search matches name/address/area; filter by type and status.
- **Lead dashboard** (`/dashboard`) — charts and stats from Data_raw (Part 8).
- **Property detail** (`/property/[id]`) — every field from your tracker,
  a running notes box (timestamped whenever saved), and separate photo and
  video galleries with upload/delete.
- **Add property** (`/property/new`) — manual entry form, same fields as
  the detail page.
- **Import CSV** (`/import`) — bulk-add from a spreadsheet export.
- **Sheet sync** (optional, Part 7) — keeps the app and your Google Sheet talking to each other
  without either one silently overwriting the other.

## Costs

Supabase free tier includes 500MB database + 1GB file storage + 2GB
bandwidth/month — plenty for text data and a reasonable number of photos.
If you upload a lot of video, you may eventually want Supabase's paid tier
(~$25/mo) for more storage — you'll get a warning in your Supabase
dashboard well before hitting any hard limit.

Vercel's free tier has no time limit and comfortably covers a small private
tool like this.
