# Invoice Flow shared data setup

## Access and accounts

Invoice Flow signs in through Supabase Auth. An account can use the app only after an administrator sets `app_metadata.invoice_flow_access` to `true`. Public sign-up does not grant app access. Only trusted Supabase `app_metadata` is used for that check; user-editable metadata is not trusted.

The `role` and `permissions` values currently affect menu visibility in the browser and are not API permission limits. Every user granted app access can read and change the full shared dataset. This version does not enforce per-company or per-record permissions, so only grant access to people who should see and edit all shared records.

## Vercel settings

Configure these server-side variables on the Vercel project:

- `SUPABASE_URL`: the full project URL, such as `https://<project-ref>.supabase.co`.
- `SUPABASE_SERVICE_KEY`: the service-role key. Keep it server-only; never place it in HTML or browser JavaScript.

The API fails closed with a generic error if either value is missing or invalid. Do not paste secrets into issue comments or chat. The public browser key is not the service key and does not bypass row-level security.

## Existing browser records

Business data is synchronized as one JSON snapshot in the existing `app_settings` table. Authentication and credential-shaped keys are excluded.

If cloud data is empty, the first device must download a backup before choosing to import its local records. If cloud and local records both exist, a backup is required before a merge. Conflicting records stop the merge for manual resolution. Existing local browser keys are never automatically removed; cloud data fills empty local defaults, and local values with data are not silently replaced.

Other devices check for updates periodically and require a reload to display the newest snapshot. This is a migration path for a shared team dataset, not a normalized multi-company database.

## Production database caution

Do not run the older `supabase/schema.sql` against the existing production project. It contains demo seed statements and does not match the live schema. This code change does not perform a production database migration or deploy.
