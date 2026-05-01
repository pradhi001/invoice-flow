# Shared Visibility & Real-Time Updates Guide

## Overview
This guide implements a system where:
- **Admin** creates users and sees all company data and user activities
- **Users** see only data they're assigned to
- **All changes** are visible in real-time across all relevant users
- **Audit trail** tracks who made what changes and when

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Admin User                          │
│  • Creates users                                     │
│  • Assigns companies to users                       │
│  • Sees all data & activities from all users        │
└────────────┬────────────────────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼──┐ ┌──▼───┐ ┌──▼───┐
│User1 │ │User2 │ │User3 │
│      │ │      │ │      │
│Co1,  │ │Co2,  │ │Co1,  │
│Co2   │ │Co3   │ │Co3   │
└──────┘ └──────┘ └──────┘
    │        │        │
    └────────┼────────┘
             │
    ┌────────▼─────────────────────────┐
    │   Supabase Database              │
    │ • Shared Companies               │
    │ • User Assignments               │
    │ • Activity Logs (audit trail)    │
    │ • Real-time Subscriptions        │
    └──────────────────────────────────┘
```

---

## Step 1: Update Database Schema

Add these tables to your `supabase/schema.sql`:

```sql
-- Update Team Members Table with user_type and company assignments
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'user' CHECK (user_type IN ('admin', 'user'));
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS company_ids UUID[] DEFAULT '{}';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- User-Company Junction Table (for flexible assignments)
CREATE TABLE IF NOT EXISTS user_company_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES team_members(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Activity Audit Trail Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_company_assignments_user ON user_company_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_assignments_company ON user_company_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
```

---

## Step 2: Update API Handlers

### 2.1 Update `api/_handlers/team_members.js`

```javascript
const supabase = require('../../lib/supabase');

module.exports = async (req, res) => {
    const { method } = req;

    try {
        // GET: List all users (admin only) or get current user
        if (method === 'GET') {
            const { user_id, include_assignments } = req.query;
            
            let query = supabase.from('team_members').select('*');
            
            if (user_id) {
                query = query.eq('id', user_id);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            if (include_assignments === 'true' && data.length > 0) {
                // Get company assignments for each user
                const usersWithAssignments = await Promise.all(data.map(async (user) => {
                    const { data: assignments } = await supabase
                        .from('user_company_assignments')
                        .select('company_id, company:companies(id, name)')
                        .eq('user_id', user.id);
                    
                    return {
                        ...user,
                        companies: assignments || []
                    };
                }));
                
                return res.status(200).json(usersWithAssignments);
            }

            return res.status(200).json(data);
        }

        // POST: Create new user (admin only)
        if (method === 'POST') {
            const { username, password, user_type, company_ids, created_by } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }

            // Create user
            const { data: newUser, error: userError } = await supabase
                .from('team_members')
                .insert([{
                    username,
                    password, // NOTE: Hash this in production!
                    user_type: user_type || 'user',
                    company_ids: company_ids || [],
                    role: user_type === 'admin' ? 'Admin' : 'User'
                }])
                .select()
                .single();

            if (userError) throw userError;

            // Create company assignments if provided
            if (company_ids && company_ids.length > 0) {
                const assignments = company_ids.map(company_id => ({
                    user_id: newUser.id,
                    company_id,
                    assigned_by: created_by
                }));

                const { error: assignError } = await supabase
                    .from('user_company_assignments')
                    .insert(assignments);

                if (assignError) throw assignError;
            }

            // Log activity
            await logActivity({
                user_id: created_by,
                table_name: 'team_members',
                record_id: newUser.id,
                action: 'CREATE',
                new_data: newUser
            });

            return res.status(201).json(newUser);
        }

        // PUT: Update user or assign companies
        if (method === 'PUT') {
            const { id, company_ids, is_active, user_type, updated_by } = req.body;

            const { data: updatedUser, error } = await supabase
                .from('team_members')
                .update({
                    company_ids: company_ids || [],
                    is_active: is_active !== undefined ? is_active : true,
                    user_type: user_type || 'user',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Update company assignments if provided
            if (company_ids) {
                // Remove old assignments
                await supabase
                    .from('user_company_assignments')
                    .delete()
                    .eq('user_id', id);

                // Add new assignments
                if (company_ids.length > 0) {
                    const assignments = company_ids.map(company_id => ({
                        user_id: id,
                        company_id,
                        assigned_by: updated_by
                    }));

                    await supabase
                        .from('user_company_assignments')
                        .insert(assignments);
                }
            }

            // Log activity
            await logActivity({
                user_id: updated_by,
                table_name: 'team_members',
                record_id: id,
                action: 'UPDATE',
                new_data: updatedUser
            });

            return res.status(200).json(updatedUser);
        }

        // DELETE: Remove user
        if (method === 'DELETE') {
            const { id, deleted_by } = req.query;

            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Log activity
            await logActivity({
                user_id: deleted_by,
                table_name: 'team_members',
                record_id: id,
                action: 'DELETE'
            });

            return res.status(200).json({ message: 'User deleted' });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end();
    } catch (error) {
        console.error('Team Members Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Helper function to log activities
async function logActivity({ user_id, table_name, record_id, action, old_data, new_data, company_id }) {
    try {
        await supabase.from('activity_logs').insert([{
            user_id,
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            company_id,
            timestamp: new Date().toISOString()
        }]);
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}
```

### 2.2 Update `api/_handlers/companies.js` with visibility logic

```javascript
const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const { user_id } = req.query;
            
            // If admin, get all companies
            const { data: user } = await supabase
                .from('team_members')
                .select('user_type, id')
                .eq('id', user_id)
                .single();

            if (user?.user_type === 'admin') {
                // Admin sees all companies
                const { data, error } = await supabase
                    .from('companies')
                    .select('*')
                    .order('name');

                if (error) throw error;
                return res.status(200).json({ success: true, companies: data });
            } else {
                // Regular user sees only assigned companies
                const { data: assignments } = await supabase
                    .from('user_company_assignments')
                    .select('company:companies(*)')
                    .eq('user_id', user_id);

                const companies = assignments?.map(a => a.company) || [];
                return res.status(200).json({ success: true, companies });
            }
        }

        if (req.method === 'POST') {
            const { name, email, phone, address, avatar_color, created_by } = req.body;
            
            if (!name) return res.status(400).json({ success: false, error: 'Company name required' });

            const { data, error } = await supabase
                .from('companies')
                .insert([{ name, email, phone, address, avatar_color: avatar_color || '#0a3d6b' }])
                .select()
                .single();

            if (error) throw error;

            // Log activity
            await logActivity({
                user_id: created_by,
                table_name: 'companies',
                record_id: data.id,
                action: 'CREATE',
                new_data: data,
                company_id: data.id
            });

            return res.status(201).json({ success: true, company: data });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });
    } catch (error) {
        console.error('Companies Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

async function logActivity({ user_id, table_name, record_id, action, old_data, new_data, company_id }) {
    try {
        await supabase.from('activity_logs').insert([{
            user_id,
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            company_id,
            timestamp: new Date().toISOString()
        }]);
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}
```

### 2.3 Create `api/_handlers/activity_logs.js`

```javascript
const supabase = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id, company_id, limit = 50, offset = 0 } = req.query;

        // Get current user to check if admin
        const { data: user } = await supabase
            .from('team_members')
            .select('user_type')
            .eq('id', user_id)
            .single();

        let query = supabase
            .from('activity_logs')
            .select(`
                *,
                user:team_members(username, id),
                company:companies(id, name)
            `)
            .order('timestamp', { ascending: false });

        // Filter by company if not admin
        if (user?.user_type !== 'admin' && company_id) {
            query = query.eq('company_id', company_id);
        } else if (company_id) {
            query = query.eq('company_id', company_id);
        }

        // Pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return res.status(200).json({
            success: true,
            activities: data,
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Activity Logs Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
```

---

## Step 3: Frontend Implementation

### 3.1 Create `lib/sessionManager.js`

```javascript
/**
 * Session Manager - Handle user login, current user state, and visibility
 */
class SessionManager {
    constructor() {
        this.currentUser = null;
        this.currentCompanies = [];
    }

    // Initialize session
    async init() {
        const storedUser = localStorage.getItem('invoice_flow_current_user');
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            await this.loadUserCompanies();
        }
    }

    // Login user
    async login(username, password) {
        try {
            const response = await fetch(`${API_BASE}/api/team_members`, {
                method: 'GET'
            });
            const users = await response.json();
            
            const user = users.find(u => u.username === username && u.password === password);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            this.currentUser = user;
            localStorage.setItem('invoice_flow_current_user', JSON.stringify(user));
            await this.loadUserCompanies();
            
            return user;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    // Load companies for current user
    async loadUserCompanies() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(
                `${API_BASE}/api/companies?user_id=${this.currentUser.id}`,
                { method: 'GET' }
            );
            const { companies } = await response.json();
            this.currentCompanies = companies;
            localStorage.setItem('invoice_flow_user_companies', JSON.stringify(companies));
        } catch (error) {
            console.error('Failed to load companies:', error);
        }
    }

    // Check if user is admin
    isAdmin() {
        return this.currentUser?.user_type === 'admin';
    }

    // Get current user ID
    getUserId() {
        return this.currentUser?.id;
    }

    // Get assigned companies
    getCompanies() {
        return this.currentCompanies;
    }

    // Check if user can view company
    canViewCompany(companyId) {
        if (this.isAdmin()) return true;
        return this.currentCompanies.some(c => c.id === companyId);
    }

    // Logout
    logout() {
        this.currentUser = null;
        this.currentCompanies = [];
        localStorage.removeItem('invoice_flow_current_user');
        localStorage.removeItem('invoice_flow_user_companies');
    }
}

// Export singleton
window.sessionManager = new SessionManager();
```

### 3.2 Create `lib/realtimeSync.js`

```javascript
/**
 * Real-time Sync Manager - Subscribe to data changes and update UI
 */
class RealtimeSync {
    constructor(supabase) {
        this.supabase = supabase;
        this.subscriptions = [];
        this.callbacks = {};
    }

    // Subscribe to table changes
    subscribeToTable(tableName, callback, userId) {
        if (!this.supabase) {
            console.warn('Supabase not available for real-time sync');
            return;
        }

        const subscription = this.supabase
            .channel(`${tableName}-updates`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: tableName
                },
                (payload) => {
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    // Subscribe to activity logs for a company
    subscribeToCompanyActivity(companyId, callback) {
        if (!this.supabase) return;

        const subscription = this.supabase
            .channel(`activity-${companyId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: `company_id=eq.${companyId}`
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    // Unsubscribe from all
    unsubscribeAll() {
        this.subscriptions.forEach(sub => {
            this.supabase.removeChannel(sub);
        });
        this.subscriptions = [];
    }

    // Cleanup
    destroy() {
        this.unsubscribeAll();
    }
}

window.realtimeSync = null;
```

### 3.3 Update `js/app.js` - Add session initialization

Add this at the top after supabase client initialization:

```javascript
// --- SESSION MANAGEMENT ---
async function initializeSession() {
    await window.sessionManager.init();
    
    // Check if user is logged in
    if (!window.sessionManager.currentUser) {
        // Redirect to login
        window.location.href = 'login.html';
        return;
    }

    // Initialize real-time sync
    if (window.supabaseClient) {
        window.realtimeSync = new RealtimeSync(window.supabaseClient);
        
        // Subscribe to companies changes
        window.realtimeSync.subscribeToTable('companies', (payload) => {
            console.log('Company updated:', payload);
            refreshCompanyData();
        });

        // Subscribe to invoices changes
        window.realtimeSync.subscribeToTable('invoices', (payload) => {
            console.log('Invoice updated:', payload);
            refreshInvoiceData();
        });
    }

    console.log('Session initialized for:', window.sessionManager.currentUser.username);
}

// Call on page load
document.addEventListener('DOMContentLoaded', initializeSession);
```

### 3.4 Update data fetching to use session

Replace direct data fetches with session-aware fetches:

```javascript
// OLD WAY (loading from localStorage)
// const companies = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');

// NEW WAY (fetch with user visibility)
async function loadCompanies() {
    const userId = window.sessionManager.getUserId();
    try {
        const response = await fetch(
            `${API_BASE}/api/companies?user_id=${userId}`
        );
        const { companies } = await response.json();
        return companies;
    } catch (error) {
        console.error('Failed to load companies:', error);
        return [];
    }
}

// Use in rendering
async function renderCompanies() {
    const companies = await loadCompanies();
    // Render companies...
}
```

---

## Step 4: Activity Tracking

### 4.1 Create Activity Dashboard component

```javascript
async function loadActivityLogs(companyId) {
    const userId = window.sessionManager.getUserId();
    
    try {
        const response = await fetch(
            `${API_BASE}/api/activity_logs?user_id=${userId}&company_id=${companyId}&limit=20`,
            { method: 'GET' }
        );
        const { activities } = await response.json();
        return activities;
    } catch (error) {
        console.error('Failed to load activity logs:', error);
        return [];
    }
}

function renderActivityFeed(activities) {
    const html = activities.map(activity => `
        <div style="padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; gap: 12px;">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #1f2937;">
                    <strong>${activity.user?.username || 'Unknown'}</strong>
                    <span style="color: #6b7280; font-weight: normal; text-transform: lowercase;">
                        ${activity.action}
                    </span>
                    ${activity.table_name}
                </div>
                <div style="font-size: 0.875rem; color: #9ca3af; margin-top: 4px;">
                    ${new Date(activity.timestamp).toLocaleString()}
                </div>
            </div>
        </div>
    `).join('');
    
    return html;
}
```

---

## Step 5: User Management Interface

### 5.1 Create user management page

```javascript
async function loadUsers() {
    if (!window.sessionManager.isAdmin()) {
        showNotification('Only admins can manage users', 'error');
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/api/team_members?include_assignments=true`,
            { method: 'GET' }
        );
        const users = await response.json();
        return users;
    } catch (error) {
        console.error('Failed to load users:', error);
        return [];
    }
}

async function createUser(username, password, companies) {
    try {
        const response = await fetch(`${API_BASE}/api/team_members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password, // NOTE: Hash on frontend or backend!
                user_type: 'user',
                company_ids: companies,
                created_by: window.sessionManager.getUserId()
            })
        });

        if (!response.ok) throw new Error('Failed to create user');
        
        const user = await response.json();
        showNotification(`User ${username} created successfully`, 'success');
        return user;
    } catch (error) {
        showNotification(error.message, 'error');
        throw error;
    }
}

async function assignCompaniesToUser(userId, companyIds) {
    try {
        const response = await fetch(`${API_BASE}/api/team_members`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: userId,
                company_ids: companyIds,
                updated_by: window.sessionManager.getUserId()
            })
        });

        if (!response.ok) throw new Error('Failed to assign companies');
        
        showNotification('Companies assigned successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
        throw error;
    }
}
```

---

## Step 6: Security Best Practices

1. **Password Hashing**: Use bcrypt on backend for password hashing
2. **JWT Tokens**: Implement JWT-based authentication instead of storing plain passwords
3. **Row-Level Security (RLS)**: Enable RLS in Supabase to restrict data at database level
4. **Input Validation**: Validate all inputs on both frontend and backend
5. **Audit Logs**: Keep complete audit trail (already implemented)

### RLS Policies Example:

```sql
-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their assigned companies
CREATE POLICY user_company_visibility ON companies
    FOR SELECT USING (
        id IN (
            SELECT company_id FROM user_company_assignments 
            WHERE user_id = auth.uid()
        )
        OR 
        -- Admin sees all
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE id = auth.uid() AND user_type = 'admin'
        )
    );

-- Policy: Only admins can create companies
CREATE POLICY admin_create_companies ON companies
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE id = auth.uid() AND user_type = 'admin'
        )
    );
```

---

## Implementation Checklist

- [ ] Add new tables to Supabase schema (user_company_assignments, activity_logs)
- [ ] Update team_members handler with user_type and company_ids
- [ ] Create activity_logs handler
- [ ] Create sessionManager.js for session management
- [ ] Create realtimeSync.js for real-time updates
- [ ] Update app.js with session initialization
- [ ] Update companies.js handler with visibility logic
- [ ] Create user management UI
- [ ] Test admin creating users and assigning companies
- [ ] Test user seeing only assigned companies
- [ ] Test real-time updates across users
- [ ] Implement password hashing (bcrypt)
- [ ] Add JWT authentication
- [ ] Enable Supabase RLS policies
- [ ] Create activity dashboard to show user actions

---

## Testing Workflow

1. **Admin Setup**:
   - Login as admin user
   - Navigate to User Management
   - Create 2 test users

2. **Company Assignment**:
   - Assign User1 to Company1 and Company2
   - Assign User2 to Company2 and Company3

3. **Data Visibility**:
   - Login as User1 → Should see Company1, Company2
   - Create invoice in Company1
   - Login as admin → Should see all companies and the new invoice

4. **Real-time Updates**:
   - Keep User1 and Admin logged in (separate browsers/tabs)
   - User1 creates an invoice
   - Admin should see it appear in real-time

5. **Activity Tracking**:
   - Check activity logs for all changes
   - Verify who made what changes and when

---

## Migration from LocalStorage

The current system uses localStorage. Migration steps:

1. Keep localStorage temporarily for fallback
2. Fetch data from Supabase API instead
3. Sync localStorage when data changes
4. Gradually remove localStorage dependencies
5. Update refresh logic to call API endpoints

Example migration pattern:

```javascript
async function loadData(key, apiEndpoint) {
    try {
        // Try API first
        const response = await fetch(apiEndpoint);
        const data = await response.json();
        
        // Backup to localStorage
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    } catch (error) {
        // Fallback to localStorage
        const cached = localStorage.getItem(key);
        if (cached) return JSON.parse(cached);
        throw error;
    }
}
```

---

## Real-time Sync Flow

```
User1 Makes Change
        │
        ▼
API Handler (log activity)
        │
        ▼
Supabase DB Updated
        │
        ▼
Realtime Event Triggered
        │
   ┌────┴────┐
   │         │
   ▼         ▼
 User1     User2
 Updates   Updates
 Local UI  Local UI
   │         │
   ▼         ▼
Admin   Activity Log
Sees    Recorded
Change
```

