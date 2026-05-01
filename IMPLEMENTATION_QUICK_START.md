/**
 * Implementation Guide - Quick Start Steps
 * Follow these steps to implement shared visibility in your app
 */

# IMPLEMENTATION CHECKLIST & QUICK START

## Phase 1: Database Setup (Day 1)

1. **Run Supabase Schema Updates**
   ```bash
   # Go to Supabase SQL Editor and run SHARED_VISIBILITY_GUIDE.md
   # Copy the SQL from "Step 1: Update Database Schema" section
   # This creates:
   # - user_company_assignments table
   # - activity_logs table
   # - Updates team_members table
   ```

2. **Verify Tables in Supabase**
   - [ ] Go to Supabase Dashboard
   - [ ] Check "user_company_assignments" table exists
   - [ ] Check "activity_logs" table exists
   - [ ] Check team_members has new columns: user_type, company_ids, is_active

---

## Phase 2: Frontend Setup (Day 1-2)

1. **Update index.html**
   Add these script imports BEFORE your app.js:

   ```html
   <!-- Session Management -->
   <script src="/lib/sessionManager.js"></script>
   <script src="/lib/realtimeSync.js"></script>
   <script src="/lib/dataSync.js"></script>

   <!-- Your existing app script -->
   <script src="/js/app.js"></script>
   ```

2. **Add Login Page**
   Create new file: `login.html`
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <title>Invoice Flow - Login</title>
       <link rel="stylesheet" href="/css/global.css">
   </head>
   <body>
       <div style="display: flex; align-items: center; justify-content: center; height: 100vh;">
           <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
               <h1 style="margin-bottom: 20px;">Invoice Flow</h1>
               <form id="loginForm" style="display: flex; flex-direction: column; gap: 16px;">
                   <input type="text" id="username" placeholder="Username" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                   <input type="password" id="password" placeholder="Password" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                   <button type="submit" style="padding: 10px; background: #0a3d6b; color: white; border: none; border-radius: 4px; cursor: pointer;">Login</button>
                   <div id="errorMsg" style="color: red; display: none;"></div>
               </form>
           </div>
       </div>

       <script src="/lib/supabase.js"></script>
       <script src="/lib/sessionManager.js"></script>
       <script>
           document.getElementById('loginForm').addEventListener('submit', async (e) => {
               e.preventDefault();
               const username = document.getElementById('username').value;
               const password = document.getElementById('password').value;

               try {
                   await window.sessionManager.login(username, password);
                   window.location.href = '/index.html';
               } catch (error) {
                   document.getElementById('errorMsg').textContent = error.message;
                   document.getElementById('errorMsg').style.display = 'block';
               }
           });
       </script>
   </body>
   </html>
   ```

3. **Update js/app.js - Add Session Check**
   Add at the very top of app.js:

   ```javascript
   // Check if user is logged in
   window.addEventListener('DOMContentLoaded', async () => {
       await window.sessionManager.init();
       
       if (!window.sessionManager.isLoggedIn()) {
           window.location.href = '/login.html';
           return;
       }

       console.log('✓ User logged in:', window.sessionManager.getUsername());
       
       // Initialize real-time sync
       if (window.supabaseClient) {
           window.realtimeSync = new RealtimeSync(window.supabaseClient);
           await window.realtimeSync.init();
       }

       // Continue with your existing initialization
       initializeApp();
   });

   async function initializeApp() {
       // Your existing app initialization code
   }
   ```

---

## Phase 3: Update API Handlers (Day 2-3)

1. **Copy Updated Handlers**
   Replace your existing handler files:

   - Copy code from SHARED_VISIBILITY_GUIDE.md Step 2.1 → `api/_handlers/team_members.js`
   - Copy code from SHARED_VISIBILITY_GUIDE.md Step 2.2 → `api/_handlers/companies.js`
   - Copy code from SHARED_VISIBILITY_GUIDE.md Step 2.3 → `api/_handlers/activity_logs.js` (create new)

2. **Update api/index.js**
   Add activity_logs handler:

   ```javascript
   const handlers = {
       ping: () => require('./_handlers/ping'),
       app_settings: () => require('./_handlers/app_settings'),
       companies: () => require('./_handlers/companies'),
       dashboard: () => require('./_handlers/dashboard'),
       delivery_challans: () => require('./_handlers/delivery_challans'),
       departments: () => require('./_handlers/departments'),
       inventory: () => require('./_handlers/inventory'),
       invoices: () => require('./_handlers/invoices'),
       loading_sheets: () => require('./_handlers/loading_sheets'),
       products: () => require('./_handlers/products'),
       purchase_orders: () => require('./_handlers/purchase_orders'),
       rdcs: () => require('./_handlers/rdcs'),
       team_members: () => require('./_handlers/team_members'),
       activity_logs: () => require('./_handlers/activity_logs')  // ADD THIS LINE
   };
   ```

---

## Phase 4: Update Data Fetching (Day 3-4)

Replace all localStorage-based data fetches with API calls:

### OLD (using localStorage):
```javascript
function loadCompanies() {
    return JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
}
```

### NEW (using DataSync):
```javascript
async function loadCompanies() {
    return await DataSync.loadCompanies();
}

// Update all calls to be async:
async function initCustomers() {
    const companies = await loadCompanies();
    renderCompanies(companies);
}
```

### Example Updates:

**For invoices:**
```javascript
// OLD
const invoices = JSON.parse(localStorage.getItem('invoice_flow_invoices') || '[]');

// NEW
const invoices = await DataSync.loadInvoices(companyId);

// Creating invoice
const newInvoice = await DataSync.createInvoice({
    invoice_number: "INV-001",
    company_id: selectedCompanyId,
    amount: 10000,
    due_date: "2026-06-01"
});
```

**For delivery challans:**
```javascript
// OLD
const dcs = JSON.parse(localStorage.getItem('invoice_flow_dcs') || '[]');

// NEW - Add new handler api/_handlers/delivery_challans.js with DataSync calls
```

---

## Phase 5: Add Real-time Updates (Day 4-5)

Update your rendering functions to refresh when data changes:

```javascript
async function initializeInvoices() {
    const companyId = getSelectedCompanyId();
    
    // Initial load
    const invoices = await DataSync.loadInvoices(companyId);
    renderInvoices(invoices);

    // Subscribe to real-time updates
    if (window.realtimeSync) {
        window.realtimeSync.subscribeToInvoices(companyId, (payload) => {
            console.log('Invoice update received:', payload.new);
            
            // Refresh invoice list
            loadAndRenderInvoices();
        });
    }
}

async function loadAndRenderInvoices() {
    const companyId = getSelectedCompanyId();
    const invoices = await DataSync.loadInvoices(companyId);
    renderInvoices(invoices);
}
```

---

## Phase 6: User Management UI (Day 5)

Create a new admin panel for managing users:

```html
<!-- Add to index.html in admin section -->
<div id="admin-user-management" style="display: none;">
    <h2>Manage Users</h2>
    
    <div style="margin-bottom: 20px;">
        <button id="btn-create-user" class="btn">Create User</button>
    </div>

    <table id="users-table" style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr style="background: #f0f0f0;">
                <th>Username</th>
                <th>Type</th>
                <th>Companies</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="users-tbody"></tbody>
    </table>

    <!-- Create User Modal -->
    <div id="modal-create-user" style="display: none;">
        <form id="form-create-user">
            <input type="text" id="username-input" placeholder="Username" required>
            <input type="password" id="password-input" placeholder="Password" required>
            
            <div>
                <label>Assign Companies:</label>
                <div id="companies-checkboxes"></div>
            </div>
            
            <button type="submit">Create User</button>
            <button type="button" onclick="document.getElementById('modal-create-user').style.display='none'">Cancel</button>
        </form>
    </div>
</div>
```

JavaScript for user management:

```javascript
async function initUserManagement() {
    // Only show for admins
    if (!window.sessionManager.isAdmin()) return;
    
    document.getElementById('admin-user-management').style.display = 'block';
    
    // Load and display users
    const response = await fetch(`${getApiBaseUrl()}/api/team_members?include_assignments=true`);
    const users = await response.json();
    
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = users.map(user => `
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
}

async function createUser() {
    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    const companies = getSelectedCompanies();

    try {
        await DataSync.createUser(username, password, companies);
        showNotification('User created successfully', 'success');
        document.getElementById('modal-create-user').style.display = 'none';
        await initUserManagement();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}
```

---

## Phase 7: Activity Dashboard (Day 5-6)

Display activity logs to show what changes were made:

```html
<div id="activity-feed" style="margin-top: 20px;">
    <h3>Recent Activity</h3>
    <div id="activity-list" style="border: 1px solid #ddd; border-radius: 4px; max-height: 400px; overflow-y: auto;"></div>
</div>
```

JavaScript:

```javascript
async function loadActivityLogs(companyId) {
    try {
        const logs = await DataSync.loadActivityLogs(companyId);
        
        const html = logs.map(log => `
            <div style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>${log.user?.username || 'System'}</strong>
                <span style="color: #666;"> ${log.action}</span>
                <span>${log.table_name}</span>
                <div style="font-size: 0.85em; color: #999;">
                    ${new Date(log.timestamp).toLocaleString()}
                </div>
            </div>
        `).join('');
        
        document.getElementById('activity-list').innerHTML = html;
    } catch (error) {
        console.error('Failed to load activity:', error);
    }
}

// Auto-refresh every 30 seconds
setInterval(() => {
    const companyId = getSelectedCompanyId();
    if (companyId) loadActivityLogs(companyId);
}, 30000);
```

---

## Testing Checklist

- [ ] **Login Test**: Login with admin credentials → Should see all companies
- [ ] **User Creation**: Create 2 new test users
- [ ] **Company Assignment**: Assign User1 to Company A & B, User2 to Company B & C
- [ ] **Visibility Test**: 
  - [ ] Login as User1 → See only Company A & B
  - [ ] Login as User2 → See only Company B & C
  - [ ] Login as Admin → See all companies
- [ ] **Data Sync Test**:
  - [ ] Open app in 2 browser tabs with different users
  - [ ] One user creates invoice → Other user should see it appear in real-time
- [ ] **Activity Logs**: 
  - [ ] Make changes in one user account
  - [ ] Check activity logs show who made what changes and when
- [ ] **Admin Dashboard**: Admin should see activity from all users

---

## Troubleshooting

### Issue: "Supabase not initialized"
**Fix**: Make sure `lib/supabase.js` is loaded in index.html BEFORE sessionManager.js

### Issue: Users can see other users' data
**Fix**: Check that visibility logic is in api/_handlers/companies.js (compare company_ids)

### Issue: Real-time updates not working
**Fix**: 
1. Check Supabase Realtime is enabled
2. Check channel subscription in realtimeSync.js
3. Open browser console and look for errors

### Issue: Activity logs not recording
**Fix**: Ensure `await logActivity()` is called after every database change in handlers

---

## Production Deployment Checklist

- [ ] Hash passwords using bcrypt (don't store plain passwords!)
- [ ] Implement JWT authentication
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set up HTTPS
- [ ] Add rate limiting
- [ ] Enable audit logging for compliance
- [ ] Test data backup and recovery

---

## Next Steps

1. Follow the phases above in order
2. Test each phase before moving to next
3. Keep this guide open for reference
4. Check SHARED_VISIBILITY_GUIDE.md for detailed implementation details
5. Review activity logs regularly to catch issues

## Need Help?

Check the following:
- Console logs in browser (F12 → Console)
- Network tab in browser dev tools (check API calls)
- Supabase logs (check for database errors)
- Terminal output from `npm run dev` (backend logs)
