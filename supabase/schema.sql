-- =============================================
--  Invoice Flow - Supabase Database Schema
--  Run this in your Supabase SQL Editor
-- =============================================

-- 1. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    initials TEXT GENERATED ALWAYS AS (
        UPPER(LEFT(name, 1) || COALESCE(LEFT(SPLIT_PART(name, ' ', 2), 1), ''))
    ) STORED,
    avatar_color TEXT DEFAULT '#0a3d6b',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('paid', 'pending', 'overdue', 'partial', 'draft', 'archived')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Transactions Table (for dashboard recent activity)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'invoice'
        CHECK (type IN ('invoice', 'challan', 'purchase_order', 'payment', 'return')),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('paid', 'pending', 'overdue', 'partial')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Delivery Challans Table
CREATE TABLE IF NOT EXISTS delivery_challans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challan_number TEXT NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('dispatched', 'delivered', 'pending', 'returned')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name TEXT NOT NULL,
    sku TEXT UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    unit_price DECIMAL(10, 2) DEFAULT 0,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'completed')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RDCs Table (Returnable Delivery Challans)
CREATE TABLE IF NOT EXISTS rdcs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rdc_number TEXT NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    dept TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB DEFAULT '[]'::jsonb,
    auto_delete_limit INTEGER DEFAULT 90,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Loading Sheets Table
CREATE TABLE IF NOT EXISTS loading_sheets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dc_number TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB DEFAULT '[]'::jsonb,
    total_nos INTEGER DEFAULT 0,
    grand_total DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    hsn TEXT,
    rate DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
--  Dashboard Stats View (for fast aggregation)
-- =============================================
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COALESCE(SUM(amount - paid_amount), 0) FROM invoices WHERE status != 'paid') AS total_outstanding,
    (SELECT COUNT(*) FROM delivery_challans WHERE status = 'pending') AS pending_challans,
    (SELECT COUNT(*) FROM invoices WHERE status NOT IN ('draft', 'archived')) AS active_invoices,
    (SELECT COUNT(*) FROM invoices WHERE status = 'overdue') AS overdue_invoices;

-- =============================================
--  Seed Data (matches dashboard mock data)
-- =============================================
INSERT INTO companies (id, name, email, avatar_color) VALUES
    ('a1a1a1a1-1111-1111-1111-111111111111', 'Global Shipping Co.', 'info@globalshipping.com', '#0a3d6b'),
    ('b2b2b2b2-2222-2222-2222-222222222222', 'Northern Transit', 'ops@northerntransit.com', '#4a6fa5'),
    ('c3c3c3c3-3333-3333-3333-333333333333', 'Metro Logistics', 'billing@metrologistics.com', '#1a5276'),
    ('d4d4d4d4-4444-4444-4444-444444444444', 'Apex Maritime', 'accounts@apexmaritime.com', '#2e4057'),
    ('e5e5e5e5-5555-5555-5555-555555555555', 'Skyline Modernity Ltd.', 'contact@skymodern.com', '#0a3d6b'),
    ('f6f6f6f6-6666-6666-6666-666666666666', 'Vista Housing Co.', 'accounts@vistahousing.io', '#4a6fa5'),
    ('a7a7a7a7-7777-7777-7777-777777777777', 'Urban Resilience Inc.', 'billing@urban.com', '#1a5276'),
    ('b8b8b8b8-8888-8888-8888-888888888888', 'Blue Rock Developments', 'accounts@bluerock.org', '#2e4057');

INSERT INTO transactions (reference, type, company_id, date, amount, status) VALUES
    ('INV-84021', 'invoice', 'a1a1a1a1-1111-1111-1111-111111111111', '2023-10-24', 12450.00, 'paid'),
    ('CHA-9923',  'challan', 'b2b2b2b2-2222-2222-2222-222222222222', '2023-10-23', 4200.00,  'pending'),
    ('INV-84019', 'invoice', 'c3c3c3c3-3333-3333-3333-333333333333', '2023-10-22', 1890.50,  'paid'),
    ('INV-84018', 'invoice', 'd4d4d4d4-4444-4444-4444-444444444444', '2023-10-22', 32000.00, 'paid');

INSERT INTO invoices (invoice_number, company_id, amount, paid_amount, due_date, status, created_at) VALUES
    ('INV-2024-001', 'e5e5e5e5-5555-5555-5555-555555555555', 12450.00, 0,     '2023-11-12', 'overdue',  '2023-10-12'),
    ('INV-2024-002', 'f6f6f6f6-6666-6666-6666-666666666666', 8200.00,  8200,  '2023-12-15', 'paid',     '2023-10-15'),
    ('INV-2024-003', 'a7a7a7a7-7777-7777-7777-777777777777', 24100.00, 10000, '2023-12-20', 'partial',  '2023-10-20'),
    ('INV-2024-004', 'b8b8b8b8-8888-8888-8888-888888888888', 5750.00,  0,     '2023-11-05', 'overdue',  '2023-10-25');

-- =============================================
--  Row Level Security (enable for production)
-- =============================================
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
