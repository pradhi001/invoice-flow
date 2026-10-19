# Shared Invoice Flow setup

## Before using shared data

Invoice Flow now signs users in through Supabase Auth. Create one Supabase Auth account for each person who should use the app. The former browser-only team list and local passwords are not login accounts and are intentionally no longer used. The app does not store account passwords in business data.

In Vercel, configure these server-side environment variables for the Invoice Flow project:

- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_SERVICE_KEY`: the Supabase service role key. Keep it server-only; never add it to HTML or browser JavaScript.

Set the Supabase Auth site URL to the live Invoice Flow domain and allow that same domain in Auth redirect URLs so password-reset links return to the app.

The existing public Supabase anon key in the browser remains a public key. It does not grant direct table access through RLS.

## Local data migration

After the code is deployed, sign in on the device that has the records you want to share. If shared cloud data is empty and local business records exist, Invoice Flow requires a JSON backup download before offering the explicit import action. Keep that backup somewhere safe. If both cloud and local records exist, choose the backup-and-merge option; records with conflicting identifiers are not uploaded and are reported for manual resolution. Choosing the shared copy also requires a backup first.

The import and merge only include business keys beginning with `invoice_flow_`. Authentication sessions, team-member password records, and credential-like keys are excluded. No local browser storage is automatically cleared during setup.

## Current storage behavior

Business data is saved in the browser and synchronized as one JSON snapshot in the existing `app_settings` table. API access requires a valid Supabase Auth access token and the service key stays on the server. Conflicting writes stop and preserve the device copy; the app asks the user to back up and reload before continuing. Other devices are checked every 30 seconds and require a reload to view a newer snapshot.

This shared snapshot approach is an initial migration path, not a normalized multi-user database. All authenticated app users can access the same business records. Do not grant Supabase Auth accounts to people who should not see the shared company data.

## Deployment notes

The feature is delivered on a feature branch and should be reviewed/merged before Vercel deploys it. Do not apply the repository's older `supabase/schema.sql`; it does not match the connected production schema.

