-- Invoice Flow: persist PO department selections.
-- Run this in Supabase SQL Editor before deploying the application changes.
alter table public.purchase_orders
  add column if not exists departments jsonb not null default '[]'::jsonb;
