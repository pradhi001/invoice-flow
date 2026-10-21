# Invoice Flow — Audit Status (2026-10-21)

## Status

No production database writes, deletes, migrations, or deployment have been performed. This document records the currently verified status and must not be interpreted as a completed implementation.

## Verified

- The repository `pradhi001/invoice-flow` uses `main` as the confirmed baseline.
- A separate branch `codex/shared-cloud-data-audit-fix` was created from `main` for isolated work.
- Static source inspection identified browser-local storage for company profile, customers, products, invoices, POs, RDCs, DCs, loading sheets, inventory, departments, team members, sessions, user/company assignments, and document sequence counters.
- The checked-in API handler for `/api/departments` reads the `departments` table and returns HTTP 500 when the Supabase query reports an error. The current handler logs the error and returns `error.message` in the response; the production request returned HTTP 500, but the deployed error cause and live schema remain unknown.
- The checked-in team-members API selects all columns including the `password` field and supports writes without an evident shared authorization layer. Do not use this design for production authentication.
- The checked-in `supabase/schema.sql` has commented-out RLS enablement statements, contains demo seed data, and cannot be assumed to match the live database.
- The backend Supabase client is in `lib/lib/supabase.js` and uses a server environment variable. Never place the service-role key in frontend code or reports.

## Not verified / blocked

- Live Supabase schema, table counts, RLS state/policies, production data contents, environment key type, staging availability, and backup restore capability have not been verified through a read-only database tool.
- Local workspace commands and build/test execution were blocked by the Windows sandbox proxy in the planner environment.
- No runtime test, unit test, import/export test, cross-device test, or production deploy has been completed.

## Safe next steps

1. Obtain approved writable repository checkout or enable the existing workspace's sandbox local-network proxy via its trusted UI/policy. Do not paste credentials into chat.
2. Obtain read-only Supabase visibility or export from the Supabase dashboard: schema/foreign keys, RLS/policies, aggregate row counts, existing department names, backup status and staging-project status. Mask business/customer data.
3. Export browser-local records from each relevant device before changing storage behavior. Do not clear browser storage.
4. Reproduce `/api/departments` HTTP 500 using safe server logs; inspect the live schema read-only first. Do not run setup SQL blindly: checked-in `schema.sql` contains demo seeds.
5. Continue code changes only on this branch. Implement secure Supabase Auth, server-side API authorization, RLS and shared data operations only after understanding schema and compatibility. Use mocks/unit tests only until staging and a verified recovery point exist.
6. Prepare a reviewable pull request and test/rollback report. Do not merge or deploy, write production data, or apply production migrations without separate explicit owner approval.

## Official department candidate names to preserve exactly

`WC`, `LE`, `EC & CPS`, `CEC`, `CPS`, `R&D`, `EC`.

Inspect live records first. Do not merge, rename or delete existing departments.
