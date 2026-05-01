/**
 * QUICK REFERENCE - Shared Visibility API
 * Copy-paste ready examples for common operations
 */

// ============================================================================
// AUTHENTICATION & SESSION
// ============================================================================

// Check if user logged in
if (window.sessionManager.isLoggedIn()) {
    console.log('Logged in as:', window.sessionManager.getUsername());
}

// Get current user ID
const userId = window.sessionManager.getUserId();

// Check if admin
if (window.sessionManager.isAdmin()) {
    // Show admin-only features
}

// Get assigned companies
const companies = window.sessionManager.getCompanies();

// Check access to company
if (window.sessionManager.canViewCompany(companyId)) {
    // Show company data
}

// Logout
window.sessionManager.logout();


// ============================================================================
// LOADING DATA
// ============================================================================

// Load all companies for current user
const companies = await DataSync.loadCompanies();

// Load invoices for specific company
const invoices = await DataSync.loadInvoices(companyId);

// Load activity logs
const logs = await DataSync.loadActivityLogs(companyId, limit=20, offset=0);


// ============================================================================
// CREATING DATA
// ============================================================================

// Create new invoice
const newInvoice = await DataSync.createInvoice({
    invoice_number: "INV-001",
    company_id: companyId,
    amount: 10000,
    due_date: "2026-06-01",
    status: "pending"
});

// Create new user (admin only)
const newUser = await DataSync.createUser(
    username="john.doe",
    password="secure123",
    companyIds=[companyId1, companyId2]
);


// ============================================================================
// UPDATING DATA
// ============================================================================

// Update invoice
const updated = await DataSync.updateInvoice(invoiceId, {
    amount: 12000,
    status: "partial",
    paid_amount: 5000
});

// Assign companies to user (admin only)
await DataSync.assignCompaniesToUser(userId, [companyId1, companyId2]);


// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

// Subscribe to invoice changes
window.realtimeSync.subscribeToInvoices(companyId, (payload) => {
    console.log('Invoice changed:', payload);
    loadAndRenderInvoices(); // Refresh UI
});

// Subscribe to activity logs
window.realtimeSync.subscribeToCompanyActivity(companyId, (activity) => {
    console.log('New activity:', activity);
    refreshActivityFeed(); // Update activity display
});

// Unsubscribe from invoices
window.realtimeSync.unsubscribeFromTable('invoices');

// Unsubscribe from all
window.realtimeSync.unsubscribeAll();


// ============================================================================
// COMPLETE EXAMPLE: Initialize Dashboard
// ============================================================================

async function initDashboard() {
    // 1. Ensure user is logged in
    await window.sessionManager.init();
    if (!window.sessionManager.isLoggedIn()) {
        window.location.href = '/login.html';
        return;
    }

    // 2. Load initial data
    const companies = await DataSync.loadCompanies();
    renderCompanyList(companies);

    // 3. Set up real-time sync
    if (window.realtimeSync) {
        // Listen to invoice changes
        window.realtimeSync.subscribeToInvoices(companies[0].id, async () => {
            const invoices = await DataSync.loadInvoices(companies[0].id);
            renderInvoiceList(invoices);
        });

        // Listen to activity
        window.realtimeSync.subscribeToCompanyActivity(companies[0].id, async () => {
            const logs = await DataSync.loadActivityLogs(companies[0].id);
            renderActivityFeed(logs);
        });
    }
}


// ============================================================================
// COMPLETE EXAMPLE: User Selection with Data Visibility
// ============================================================================

async function onCompanySelected(companyId) {
    // Check if user can access this company
    if (!window.sessionManager.canViewCompany(companyId)) {
        showError('You do not have access to this company');
        return;
    }

    // Load company-specific data
    const invoices = await DataSync.loadInvoices(companyId);
    const activity = await DataSync.loadActivityLogs(companyId);

    // Render UI
    renderInvoices(invoices);
    renderActivity(activity);

    // Subscribe to real-time changes
    if (window.realtimeSync) {
        window.realtimeSync.unsubscribeAll();
        
        window.realtimeSync.subscribeToInvoices(companyId, async () => {
            const updated = await DataSync.loadInvoices(companyId);
            renderInvoices(updated);
        });
    }
}


// ============================================================================
// COMPLETE EXAMPLE: Admin User Management
// ============================================================================

async function adminCreateUser() {
    if (!window.sessionManager.isAdmin()) {
        showError('Admin only');
        return;
    }

    const username = prompt('Username:');
    const password = prompt('Password:');
    const companyIds = getUserSelectedCompanies(); // From UI

    try {
        const newUser = await DataSync.createUser(
            username,
            password,
            companyIds
        );
        showSuccess(`User created: ${username}`);
    } catch (error) {
        showError(`Failed: ${error.message}`);
    }
}

async function adminAssignCompanies(userId, companyIds) {
    if (!window.sessionManager.isAdmin()) {
        showError('Admin only');
        return;
    }

    try {
        await DataSync.assignCompaniesToUser(userId, companyIds);
        showSuccess('Companies assigned');
    } catch (error) {
        showError(`Failed: ${error.message}`);
    }
}


// ============================================================================
// HELPER: Activity Feed Rendering
// ============================================================================

function renderActivityFeed(activities) {
    const html = activities.map(activity => `
        <div style="padding: 12px; border-bottom: 1px solid #eee;">
            <strong>${activity.user?.username || 'System'}</strong>
            <span style="color: #999;"> ${activity.action} </span>
            <code>${activity.table_name}</code>
            <div style="font-size: 0.85em; color: #ccc;">
                ${new Date(activity.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');
    
    document.getElementById('activity-feed').innerHTML = html;
}


// ============================================================================
// HELPER: Company Selector (Admin)
// ============================================================================

async function renderCompanySelector(containerId) {
    const companies = await DataSync.loadCompanies();
    
    const html = companies.map(c => `
        <option value="${c.id}">${c.name}</option>
    `).join('');
    
    document.getElementById(containerId).innerHTML = html;
}


// ============================================================================
// HELPER: User List (Admin)
// ============================================================================

async function loadAndRenderUsers() {
    if (!window.sessionManager.isAdmin()) return;

    try {
        const response = await fetch(
            `${DataSync.getApiBaseUrl()}/api/team_members?include_assignments=true`
        );
        const users = await response.json();

        const html = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.user_type}</td>
                <td>${user.companies?.length || 0}</td>
                <td>
                    <button onclick="editUser('${user.id}')">Edit</button>
                    <button onclick="deleteUser('${user.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

        document.getElementById('users-table-body').innerHTML = html;
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}


// ============================================================================
// ERROR HANDLING PATTERNS
// ============================================================================

// Pattern 1: Try-catch with fallback
async function loadDataSafely(companyId) {
    try {
        return await DataSync.loadInvoices(companyId);
    } catch (error) {
        console.error('Load failed:', error);
        showError('Failed to load data');
        return [];
    }
}

// Pattern 2: Access control check
async function accessProtectedData(companyId) {
    if (!window.sessionManager.canViewCompany(companyId)) {
        throw new Error('Access denied');
    }
    return await DataSync.loadInvoices(companyId);
}

// Pattern 3: Permission check for admin operations
async function performAdminOperation() {
    if (!window.sessionManager.isAdmin()) {
        throw new Error('Admin only operation');
    }
    // Proceed with operation
}


// ============================================================================
// USEFUL DEBUGGING
// ============================================================================

// Check session state
console.log('Current User:', window.sessionManager.currentUser);
console.log('Assigned Companies:', window.sessionManager.getCompanies());
console.log('Is Admin:', window.sessionManager.isAdmin());

// Check real-time subscriptions
console.log('Active Subscriptions:', window.realtimeSync?.getActiveSubscriptions());

// Monitor API calls
window.API_BASE = '...'; // Check this is set correctly

// Verify Supabase connection
console.log('Supabase:', window.supabaseClient ? 'Connected' : 'Not connected');
