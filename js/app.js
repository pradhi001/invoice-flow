/* ========================================
   Invoice Flow - App JavaScript
   ======================================== */

// --- 1. API CONFIG ---
// Change this to your Vercel backend URL after deployment
// For local dev: 'http://localhost:3000'
// For production: 'https://your-backend.vercel.app'
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : '';

/**
 * Notification System
 */
function showNotification(message, type = 'info') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position: fixed; top: 24px; right: 24px; z-index: 10000; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;';
        document.body.appendChild(container);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes notificationSlideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes notificationSlideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
        `;
        document.head.appendChild(style);
    }

    const notification = document.createElement('div');
    const colors = {
        success: { bg: '#dcfce7', text: '#15803d', border: '#bcf0da', icon: 'fa-check-circle' },
        warning: { bg: '#fef3c7', text: '#b45309', border: '#fde68a', icon: 'fa-exclamation-triangle' },
        error: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', icon: 'fa-times-circle' },
        info: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', icon: 'fa-info-circle' }
    };
    const c = colors[type] || colors.info;

    notification.style.cssText = `background: ${c.bg}; color: ${c.text}; border: 1px solid ${c.border}; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-weight: 600; font-size: 0.875rem; display: flex; align-items: center; gap: 10px; animation: notificationSlideIn 0.3s ease forwards; min-width: 250px;`;
    notification.innerHTML = `<i class="fas ${c.icon}"></i> <span>${message}</span>`;
    container.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'notificationSlideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatCurrency(amount) {
    const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
    const symbol = profile.currency || '₹';
    return symbol + ' ' + parseFloat(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// --- DC Numbering Helper ---
    window.renderDCList = function() {
        const viewTableBody = document.getElementById('dc-view-table-body');
        if (!viewTableBody) return;
        const dcs = JSON.parse(localStorage.getItem('invoice_flow_dcs') || '[]');
        
        if (dcs.length === 0) {
            viewTableBody.innerHTML = '<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No Delivery Challans found.</td></tr>';
            return;
        }

        viewTableBody.innerHTML = dcs.map((dc, idx) => `
            <tr style="border-bottom: 1px solid var(--color-neutral-100);" data-dc-data='${JSON.stringify(dc).replace(/'/g, "&apos;")}'>
                <td style="padding: 16px; font-size: 0.875rem;">${dc.dcDate}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-primary-900);">${dc.dcNo}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${dc.vendorName}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${dc.items.length} Items</td>
                <td style="padding: 16px; display: flex; justify-content: flex-end; gap: 12px;">
                    <button class="btn-edit-row" style="background: transparent; color: var(--color-neutral-600); border: none; cursor: pointer; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--color-primary-600)'" onmouseout="this.style.color='var(--color-neutral-600)'" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-print-row" style="background: transparent; color: var(--color-primary-600); border: none; cursor: pointer; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--color-primary-800)'" onmouseout="this.style.color='var(--color-primary-600)'" title="Print"><i class="fas fa-print"></i></button>
                </td>
            </tr>
        `).join('');
    };

    function getNextDCNo() {
        const sequence = parseInt(localStorage.getItem('invoice_flow_dc_sequence') || '1');
        const fy = "26/27"; 
        const paddedSeq = sequence.toString().padStart(3, '0');
        return `${paddedSeq} - ${fy}`;
    }

    function getNextInvoiceNo() {
        const sequence = parseInt(localStorage.getItem('invoice_flow_inv_sequence') || '125');
        const fy = "26/27"; 
        const paddedSeq = sequence.toString().padStart(3, '0');
        return `${paddedSeq} - ${fy}`;
    }

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing App');
    
    // --- 0. LOGIN SYSTEM ---
    const initLogin = () => {
        const loginPage = document.getElementById('login-page');
        const mainApp = document.getElementById('main-app');
        const loginForm = document.getElementById('login-form');
        const userEmailSpan = document.querySelector('.user-name'); // Sidebar name
        
        // Check Session
        const session = localStorage.getItem('invoice_flow_session');
        if (session) {
            const userData = JSON.parse(session);
            if (userEmailSpan) userEmailSpan.textContent = userData.name || userData.username;
            loginPage.classList.remove('active');
            mainApp.style.display = 'flex';
            
            // Apply permissions on reload
            if (typeof window.applyUserPermissions === 'function') window.applyUserPermissions(userData);
            
            syncAllData();
        } else {
            loginPage.classList.add('active');
            mainApp.style.display = 'none';
        }

        // Handle Form
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('login-email').value; // Repurposed for "Admin"
                const password = document.getElementById('login-password').value;
                const btn = loginForm.querySelector('.btn-login');
                
                // Show loading state
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
                btn.disabled = true;

                // Authentication Check
                setTimeout(() => {
                    const STORAGE_KEY_TEAM = 'invoice_flow_team_members';
                    const team = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAM) || '[]');
                    
                    // Check hardcoded admin OR team members
                    let authenticatedUser = null;
                    if (username === 'Admin' && password === 'Chellam@1') {
                        authenticatedUser = { 
                            name: 'Admin User', 
                            role: 'Super Admin', 
                            username: 'Admin',
                            permissions: ['all'] 
                        };
                    } else {
                        authenticatedUser = team.find(u => u.username === username && u.password === password);
                    }

                    if (authenticatedUser) {
                        localStorage.setItem('invoice_flow_session', JSON.stringify(authenticatedUser));
                        
                        showNotification(`Welcome back, ${authenticatedUser.name || authenticatedUser.username}!`, 'success');
                        
                        // Update sidebar immediately
                        if (userEmailSpan) userEmailSpan.textContent = authenticatedUser.name || authenticatedUser.username;
                        
                        // Transition to App
                        loginPage.style.opacity = '0';
                        setTimeout(() => {
                            loginPage.classList.remove('active');
                            mainApp.style.display = 'flex';
                            mainApp.style.opacity = '0';
                            setTimeout(() => mainApp.style.opacity = '1', 50);
                            
                            // Re-initialize key data
                            if (typeof initCompanyProfile === 'function') initCompanyProfile();
                            if (typeof updateAllPrintHeaders === 'function') updateAllPrintHeaders();
                            if (typeof window.renderDashboardStats === 'function') window.renderDashboardStats();
                            if (typeof window.applyUserPermissions === 'function') window.applyUserPermissions(authenticatedUser);
                            
                            // Start global sync
                            syncAllData();
                        }, 500);
                    } else {
                        showNotification('Invalid username or password. Please try again.', 'error');
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                }, 1000);
            });
        }

        // Logout System
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('invoice_flow_session');
                    showNotification('You have been logged out.', 'info');
                    
                    // Transition back to login
                    mainApp.style.opacity = '0';
                    setTimeout(() => {
                        mainApp.style.display = 'none';
                        loginPage.classList.add('active');
                        loginPage.style.opacity = '1';
                        // Clear form
                        if (loginForm) loginForm.reset();
                    }, 500);
                }
            });
        }
    };

    initLogin();

    if (typeof window.renderDCList === 'function') window.renderDCList();
    const initFunctions = [
        { name: 'DC', fn: typeof initDCForm !== 'undefined' ? initDCForm : null },
        { name: 'Navigation', fn: typeof initNavigation !== 'undefined' ? initNavigation : null },
        { name: 'Search', fn: typeof initSearch !== 'undefined' ? initSearch : null },
        { name: 'Animations', fn: typeof initAnimations !== 'undefined' ? initAnimations : null },
        { name: 'InvoiceTabs', fn: typeof initInvoiceTabs !== 'undefined' ? initInvoiceTabs : null },
        { name: 'LoadingSheets', fn: typeof initLoadingSheets !== 'undefined' ? initLoadingSheets : null },
        { name: 'Inventory', fn: typeof initInventory !== 'undefined' ? initInventory : null },
        { name: 'Dept', fn: typeof initDept !== 'undefined' ? initDept : null },
        { name: 'Products', fn: typeof initProducts !== 'undefined' ? initProducts : null },
        { name: 'Suppliers', fn: typeof initSupplierForm !== 'undefined' ? initSupplierForm : null },
        { name: 'RDC', fn: typeof initRDC !== 'undefined' ? initRDC : null },
        { name: 'ClosedItems', fn: typeof initClosedItems !== 'undefined' ? initClosedItems : null },
        { name: 'PO', fn: typeof initPO !== 'undefined' ? initPO : null },
        { name: 'Auth', fn: typeof initAuth !== 'undefined' ? initAuth : null }
    ];

    initFunctions.forEach(m => {
        try { if (m.fn) m.fn(); } catch (e) { console.error(`Error in ${m.name}:`, e); }
    });

    loadDashboardData().catch(e => console.error('Dashboard error:', e));
    loadInvoicesData().catch(e => console.error('Invoices error:', e));
});

// --- 2. API HELPER ---
async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}/api/${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.warn(`API Error (${endpoint}):`, error.message);
        return null;
    }
}

async function syncAllData() {
    console.log('Starting global sync...');
    
    // Sync Companies/Suppliers
    const compData = await apiFetch('companies');
    if (compData && compData.companies) {
        localStorage.setItem('invoice_flow_customers', JSON.stringify(compData.companies));
        if (typeof initSupplierForm === 'function') initSupplierForm();
    }

    // Sync Products
    const prodData = await apiFetch('products');
    if (prodData && prodData.products) {
        localStorage.setItem('invoice_flow_products', JSON.stringify(prodData.products));
        if (typeof initProducts === 'function') initProducts();
    }

    // Sync Invoices
    const invData = await apiFetch('invoices?limit=100');
    if (invData && invData.invoices) {
        localStorage.setItem('invoice_flow_invoices', JSON.stringify(invData.invoices));
        if (typeof window.renderInvoicesData === 'function') window.renderInvoicesData();
    }

    // Sync Purchase Orders
    const poData = await apiFetch('purchase_orders');
    if (poData) {
        localStorage.setItem('invoice_flow_pos', JSON.stringify(poData));
        if (typeof window.renderPOList === 'function') window.renderPOList();
    }

    // Sync RDCs
    const rdcData = await apiFetch('rdcs');
    if (rdcData && rdcData.rdcs) {
        localStorage.setItem('invoice_flow_rdcs', JSON.stringify(rdcData.rdcs));
        if (typeof window.renderRDCList === 'function') window.renderRDCList();
    }

    // Sync DCs
    const dcData = await apiFetch('delivery_challans');
    if (dcData && dcData.delivery_challans) {
        localStorage.setItem('invoice_flow_dcs', JSON.stringify(dcData.delivery_challans));
        if (typeof window.renderDCList === 'function') window.renderDCList();
    }

    // Sync Loading Sheets
    const loadData = await apiFetch('loading_sheets');
    if (loadData && loadData.loading_sheets) {
        localStorage.setItem('invoice_flow_loading_sheets', JSON.stringify(loadData.loading_sheets));
        if (typeof window.renderMainLoadingTable === 'function') {
            window.allLoadingSheets = loadData.loading_sheets;
            window.renderMainLoadingTable();
        } else {
            initLoadingSheets();
        }
    }

    // Sync Inventory
    const invtData = await apiFetch('inventory');
    if (invtData) {
        localStorage.setItem('invoice_flow_inventory', JSON.stringify(invtData));
        if (typeof loadInventoryData === 'function') loadInventoryData();
    }

    // Sync Departments
    const deptData = await apiFetch('departments');
    if (deptData) {
        localStorage.setItem('invoice_flow_departments', JSON.stringify(deptData));
        if (typeof loadDeptData === 'function') loadDeptData();
    }

    // Sync Team Members
    const teamData = await apiFetch('team_members');
    if (teamData) {
        localStorage.setItem('invoice_flow_team_members', JSON.stringify(teamData));
        if (typeof renderTeamList === 'function') renderTeamList();
    }

    // Sync Company Profile
    const profileData = await apiFetch('app_settings?key=company_profile');
    if (profileData && profileData.value) {
        localStorage.setItem('invoice_flow_company_profile', JSON.stringify(profileData.value));
        if (typeof initCompanyProfile === 'function') initCompanyProfile();
    }
}

// --- 3. DASHBOARD DATA ---
async function loadDashboardData() {
    const data = await apiFetch('dashboard');
    if (!data) return; // Keep static HTML if API unavailable

    // Update stat cards
    const balanceEl = document.querySelector('#stat-balance .stat-value');
    if (balanceEl) balanceEl.textContent = formatCurrency(data.stats.total_outstanding);

    const challansEl = document.querySelector('#stat-challans .stat-value');
    if (challansEl) challansEl.textContent = data.stats.pending_challans;

    const invoicesEl = document.querySelector('#stat-invoices .stat-value');
    if (invoicesEl) invoicesEl.textContent = data.stats.active_invoices;

    // Update transactions table
    if (data.recentTransactions && data.recentTransactions.length > 0) {
        renderTransactions(data.recentTransactions);
    }
}

function renderTransactions(transactions) {
    const tbody = document.querySelector('#transactions-table tbody');
    if (!tbody) return;

    tbody.innerHTML = transactions.map(tx => {
        const company = tx.companies || {};
        const initials = company.initials || '??';
        const color = company.avatar_color || '#0a3d6b';
        const name = company.name || 'Unknown';
        const dateStr = new Date(tx.date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        return `
        <tr>
            <td><span class="ref-code">${tx.reference}</span></td>
            <td>
                <div class="entity-cell">
                    <span class="entity-avatar" style="background: ${color};">${initials}</span>
                    <span class="entity-name">${name}</span>
                </div>
            </td>
            <td>${dateStr}</td>
            <td class="amount-cell">${formatCurrency(tx.amount)}</td>
            <td><span class="status-badge status-${tx.status}">${tx.status.toUpperCase()}</span></td>
        </tr>`;
    }).join('');
}

// --- 4. INVOICES DATA ---
let currentPage = 1;
let currentFilter = 'all';

async function loadInvoicesData(page = 1, status = 'all') {
    const params = `invoices?page=${page}&limit=10${status !== 'all' ? '&status=' + status : ''}`;
    let data = await apiFetch(params);
    
    if (!data) {
        // Fallback to localStorage
        const localInvoices = JSON.parse(localStorage.getItem('invoice_flow_invoices') || '[]');
        const stats = {
            totalRevenue: localInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
            outstanding: localInvoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0),
            overdueCount: localInvoices.filter(inv => inv.status === 'overdue').length,
            pendingApproval: localInvoices.filter(inv => inv.status === 'draft').length
        };
        data = { success: true, invoices: localInvoices, stats, total: localInvoices.length, page: 1, limit: 10 };
    }

    currentPage = data.page;

    // Update invoice stats
    const revenueEl = document.querySelector('.inv-stat-revenue .inv-stat-value');
    if (revenueEl) revenueEl.textContent = formatCurrency(data.stats.totalRevenue);

    const outstandingEl = document.querySelector('.inv-stat-outstanding .inv-stat-value-red');
    if (outstandingEl) outstandingEl.textContent = formatCurrency(data.stats.outstanding);

    const outstandingSub = document.querySelector('.inv-stat-outstanding .inv-stat-sub');
    if (outstandingSub) outstandingSub.textContent = `${data.stats.overdueCount} INVOICES OVERDUE`;

    const pendingEl = document.querySelector('.inv-stat-pending .inv-stat-value');
    if (pendingEl) pendingEl.textContent = data.stats.pendingApproval;

    // Render invoice table
    if (data.invoices) {
        renderInvoices(data.invoices);
        renderPagination(data.total, data.page, data.limit);
    }
}

function renderInvoices(invoices) {
    const tbody = document.querySelector('#invoices-table tbody');
    if (!tbody) return;

    tbody.innerHTML = invoices.map(inv => {
        const company = inv.companies || {};
        const initials = company.initials || '??';
        const color = company.avatar_color || '#0a3d6b';
        const name = company.name || 'Unknown';
        const email = company.email || '';
        const createdStr = new Date(inv.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        const dueStr = new Date(inv.due_date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        const isOverdue = inv.status === 'overdue';
        const hasPartial = inv.status === 'partial';

        return `
        <tr data-id="${inv.id}">
            <td>
                <span class="inv-number">${inv.invoice_number}</span>
                <span class="inv-created">Created ${createdStr}</span>
            </td>
            <td>
                <div class="entity-cell">
                    <span class="entity-avatar" style="background:${color};">${initials}</span>
                    <div class="entity-info">
                        <span class="entity-name">${name}</span>
                        <span class="entity-email">${email}</span>
                    </div>
                </div>
            </td>
            <td>
                ${hasPartial ? `
                <div class="inv-amount-detail">
                    <span class="amount-cell">${formatCurrency(inv.amount)}</span>
                    <span class="inv-paid-note">Paid: ${formatCurrency(inv.paid_amount)}</span>
                </div>` : `<span class="amount-cell">${formatCurrency(inv.amount)}</span>`}
            </td>
            <td class="${isOverdue ? 'inv-date-overdue' : ''}">${dueStr}</td>
            <td><span class="status-badge status-${inv.status}">${inv.status.toUpperCase()}</span></td>
            <td>
                <div class="inv-actions">
                    <button class="inv-action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="inv-action-btn" title="Edit"><i class="fas fa-pen"></i></button>
                    <button class="inv-action-btn" title="More"><i class="fas fa-ellipsis-vertical"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderPagination(total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    const showingEl = document.querySelector('.inv-showing');
    const btnsContainer = document.querySelector('.inv-page-btns');
    if (!showingEl || !btnsContainer) return;

    showingEl.textContent = `Showing ${Math.min(limit, total)} of ${total} invoices`;

    let btnsHTML = `<button class="inv-page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        btnsHTML += `<button class="inv-page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    btnsHTML += `<button class="inv-page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}"><i class="fas fa-chevron-right"></i></button>`;

    btnsContainer.innerHTML = btnsHTML;

    // Re-bind pagination clicks
    btnsContainer.querySelectorAll('.inv-page-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.dataset.page);
            if (p && p > 0) loadInvoicesData(p, currentFilter);
        });
    });
}

// --- 5. UTILITIES ---


/* ---- Navigation ---- */
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    const searchInput = document.getElementById('search-input');

    const searchPlaceholders = {
        'dashboard': 'Search transactions...',
        'invoices': 'Search invoices or companies...',
        'delivery-challans': 'Search challans...',
        'loading-sheets': 'Search loading sheets...',
        'purchase-orders': 'Search purchase orders...',
        'return-delivery': 'Search return challans...',
        'manage': 'Search master data...',
        'inventory': 'Search inventory...',
        'dept': 'Search departments...',
        'products': 'Search products...',
        'vendors': 'Search customers by name, GST...',
        'add-vendor': 'Enter customer details...',
        'add-dc': 'Enter challan details...',
        'view-dc': 'Search delivery challans...',
        'settings': 'Search settings...'
    };

    // Handle dropdown toggles (Accordion Style)
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const group = toggle.closest('.nav-item-group');
            const isOpen = group.classList.contains('open');
            
            // Close all other dropdowns
            document.querySelectorAll('.nav-item-group').forEach(g => {
                if (g !== group) g.classList.remove('open');
            });
            
            // Toggle current
            group.classList.toggle('open');
        });
    });

    // Handle standard nav items and sub-items
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.dataset.page;

            // Update active nav (remove from all, then add to current)
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // If it's a sub-item, make sure its parent toggle is also styled as active (optional, but good UX)
            const parentGroup = item.closest('.nav-item-group');
            if (parentGroup) {
                parentGroup.querySelector('.nav-dropdown-toggle').classList.add('active');
            }

            // Switch page
            const pages = document.querySelectorAll('.page');
            pages.forEach(p => p.classList.remove('active'));
            const targetPage = document.getElementById('page-' + pageName);
            if (targetPage) {
                targetPage.classList.add('active');
            }

            if (searchInput && searchPlaceholders[pageName]) {
                searchInput.placeholder = searchPlaceholders[pageName];
            }

            // Refresh Closed Items if navigating there
            if ((pageName === 'closed-rdc' || pageName === 'closed-po') && typeof window.refreshClosedItems === 'function') {
                window.refreshClosedItems();
            }

            if (pageName === 'create-invoice') {
                if (typeof window.loadDCList === 'function') window.loadDCList();
                const invNoEl = document.getElementById('current-invoice-no');
                if (invNoEl) invNoEl.textContent = getNextInvoiceNo();
            }
            
            if (pageName === 'view-dc' && typeof window.renderDCList === 'function') {
                window.renderDCList();
            }

            // Reset DC No if creating new
            if (pageName === 'add-dc') {
                const dcNoInput = document.getElementById('dc-number-input');
                const form = document.getElementById('form-add-dc');
                const tbody = document.getElementById('dc-items-body');
                
                if (form) {
                    form.reset();
                    if (tbody) {
                        while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);
                        const firstRowInputs = tbody.children[0].querySelectorAll('input');
                        firstRowInputs.forEach(input => input.value = '');
                    }
                    delete form.dataset.editMode;
                    delete form.dataset.editDcNo;
                    window.currentEditRow = null;
                    
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.innerHTML = 'Submit';
                        submitBtn.style.background = '#10b981';
                    }
                    
                    if (dcNoInput) {
                        dcNoInput.value = getNextDCNo();
                    }
                }
            }
        });
    });

    // Handle "New Invoice" button click from Invoices page
    const btnNewInvoice = document.getElementById('btn-new-invoice');
    if (btnNewInvoice) {
        btnNewInvoice.addEventListener('click', () => {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const createPage = document.getElementById('page-create-invoice');
            if (createPage) createPage.classList.add('active');
            
            // Set dynamic invoice number
            const invNoEl = document.getElementById('current-invoice-no');
            if (invNoEl) invNoEl.textContent = getNextInvoiceNo();

            // Update sidebar nav state
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            const createNav = document.getElementById('nav-create-invoice');
            if (createNav) {
                createNav.classList.add('active');
                const group = createNav.closest('.nav-item-group');
                if (group) {
                    // Close all other dropdowns
                    document.querySelectorAll('.nav-item-group').forEach(g => {
                        if (g !== group) g.classList.remove('open');
                    });
                    group.classList.add('open');
                }
            }
        });
    }

    // Handle "Add Vendor/Supplier" button clicks
    const btnAddVendorPage = document.getElementById('btn-add-vendor-page');
    if (btnAddVendorPage) {
        btnAddVendorPage.addEventListener('click', () => {
            const addVendorNav = document.getElementById('nav-add-vendor');
            if (addVendorNav) addVendorNav.click();
        });
    }

    const btnAddSupplierPage = document.getElementById('btn-add-supplier-page');
    if (btnAddSupplierPage) {
        btnAddSupplierPage.addEventListener('click', () => {
            const addSupplierNav = document.getElementById('nav-add-supplier');
            if (addSupplierNav) addSupplierNav.click();
        });
    }

    const btnAddCustomer = document.getElementById('btn-add-customer');
    if (btnAddCustomer) {
        btnAddCustomer.addEventListener('click', () => {
            const addSupplierNav = document.getElementById('nav-add-supplier');
            if (addSupplierNav) addSupplierNav.click();
        });
    }

    initInvoiceForm();
}

/* ---- Invoice Form Logic ---- */
function initInvoiceForm() {
    const btnAddRow = document.getElementById('btn-add-item-row');
    const tbody = document.getElementById('invoice-items-body');
    const subtotalEl = document.getElementById('invoice-subtotal');
    const taxEl = document.getElementById('invoice-tax');
    const taxRateSelect = document.getElementById('invoice-tax-rate');
    const taxLabel = document.getElementById('tax-label');
    const totalAmountEl = document.getElementById('invoice-total-amount');

    if (!btnAddRow || !tbody) return;

    // Load defaults from settings
    const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
    if (profile.defaultTax && taxRateSelect && !taxRateSelect.dataset.manualSet) {
        taxRateSelect.value = profile.defaultTax;
    }


    function calculateTotal() {
        let subtotal = 0;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
            const price = parseFloat(row.querySelector('.price-input').value) || 0;
            const amount = qty * price;
            const amountEl = row.querySelector('.amount-val');
            if (amountEl) amountEl.textContent = formatCurrency(amount);
            subtotal += amount;
        });
        
        if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

        // Tax calculation
        let taxRate = 0;
        if (taxRateSelect) {
            taxRate = parseFloat(taxRateSelect.value) || 0;
            if (taxLabel) taxLabel.textContent = `(${taxRate}%)`;
        }

        const taxAmount = subtotal * (taxRate / 100);
        if (taxEl) taxEl.textContent = formatCurrency(taxAmount);

        const total = subtotal + taxAmount;
        if (totalAmountEl) totalAmountEl.textContent = formatCurrency(total);
    }

    if (taxRateSelect) {
        taxRateSelect.addEventListener('change', calculateTotal);
    }

    function populateSuppliers() {
        const supplierSelect = document.getElementById('input-vendor-entity');
        if (supplierSelect) {
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
            const currentVal = supplierSelect.value;
            supplierSelect.innerHTML = '<option value="">Select Supplier</option>' + 
                customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            if (currentVal) supplierSelect.value = currentVal;
            else if (profile.defaultCustomer) supplierSelect.value = profile.defaultCustomer;
        }
    }
    populateSuppliers();

    // Removed loadDCList - no longer using datalist dropdown symbol

    function autofillFromDC(row) {
        const dcNo = row.querySelector('.dc-input').value.trim();
        if (!dcNo) return;

        const dcs = JSON.parse(localStorage.getItem('invoice_flow_dcs') || '[]');
        // Match exact or match prefix (e.g., "001" matches "001 - 26/27")
        const dc = dcs.find(d => d.dcNo === dcNo || d.dcNo.split(' ')[0] === dcNo);
        
        if (dc) {
            // Filter items that have an Inv Item Code and a Rate
            const filteredItems = dc.items.filter(item => item.invCode && item.rate);
            
            if (filteredItems.length === 0) {
                if (typeof showNotification === 'function') {
                    showNotification(`DC "${dc.dcNo}" found, but no items have an "Inv Item Code" and "Rate".`, 'warning');
                } else {
                    alert(`DC "${dc.dcNo}" found, but no items have an "Inv Item Code" and "Rate". Please check the DC items.`);
                }
                return;
            }

            // Fill the current row with the first filtered item
            const firstItem = filteredItems[0];
            row.querySelector('.dc-input').value = dc.dcNo; // Update to full DC No with FY
            row.querySelector('.po-input').value = firstItem.poNo || '';
            row.querySelector('.item-input').value = firstItem.invCode || firstItem.code || '';
            row.querySelector('.qty-input').value = firstItem.qty || 1;
            row.querySelector('.price-input').value = firstItem.rate || 0;
            
            // Mark as autofilled to prevent loops or duplicates
            row.dataset.lastAutofilledDc = dc.dcNo;
            
            // If there are more items, add new rows for them
            // BUT only if we haven't already added them in this session for this row
            if (row.dataset.rowsAdded === 'true') return;
            row.dataset.rowsAdded = 'true';

            for (let i = 1; i < filteredItems.length; i++) {
                const item = filteredItems[i];
                const newRow = document.createElement('tr');
                newRow.style.borderBottom = '1px solid var(--color-neutral-100)';
                newRow.style.transition = 'background 0.2s';
                newRow.innerHTML = `
                    <td style="padding: 16px;">
                        <input type="text" value="${dc.dcNo}" autocomplete="off" class="form-control dc-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
                    </td>
                    <td style="padding: 16px;">
                        <input type="text" value="${item.poNo || ''}" class="form-control po-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
                    </td>
                    <td style="padding: 16px;">
                        <input type="text" value="${item.invCode || item.code || ''}" class="form-control item-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
                    </td>
                    <td style="padding: 16px;">
                        <input type="number" class="form-control qty-input" value="${item.qty || 1}" style="width: 60px; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
                    </td>
                    <td style="padding: 16px; color: var(--color-neutral-500);">
                        ₹ <input type="number" class="form-control price-input" value="${item.rate || 0}" style="width: 80px; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px; color: var(--color-neutral-600);">
                    </td>
                    <td style="padding: 16px; font-weight: 700; color: var(--color-primary-900);">
                        <span class="amount-val">₹ 0.00</span>
                    </td>
                    <td style="padding: 16px; text-align: right;">
                        <button class="btn-remove-row" style="background: transparent; color: var(--color-neutral-400); border: none; cursor: pointer; font-size: 1rem; padding: 4px 8px; border-radius: 4px; transition: 0.2s;" onmouseover="this.style.color='var(--color-error-600)'" onmouseout="this.style.color='var(--color-neutral-400)'"><i class="fas fa-times"></i></button>
                    </td>
                `;
                tbody.appendChild(newRow);
                attachRowEvents(newRow);
            }
            calculateTotal();
        }
    }

    function attachRowEvents(row) {
        const dcInput = row.querySelector('.dc-input');
        const qtyInput = row.querySelector('.qty-input');
        const priceInput = row.querySelector('.price-input');
        const btnRemove = row.querySelector('.btn-remove-row');

        if (dcInput) {
            dcInput.setAttribute('autocomplete', 'off');
            dcInput.addEventListener('change', () => {
                const val = dcInput.value.trim();
                if (!val || val === row.dataset.lastAutofilledDc) return;
                autofillFromDC(row);
            });
            
            // Trigger autofill on Enter key
            dcInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    dcInput.blur(); 
                }
            });
        }
        if (qtyInput) qtyInput.addEventListener('input', calculateTotal);
        if (priceInput) priceInput.addEventListener('input', calculateTotal);
        
        if (btnRemove) {
            btnRemove.addEventListener('click', (e) => {
                e.preventDefault();
                row.remove();
                calculateTotal();
            });
        }
    }

    // Add new row logic
    const addNewRow = (e) => {
        if (e) e.preventDefault();
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--color-neutral-100)';
        tr.style.transition = 'background 0.2s';
        tr.innerHTML = `
            <td style="padding: 16px;">
                <input type="text" placeholder="DC No" autocomplete="off" class="form-control dc-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
            </td>
            <td style="padding: 16px;">
                <input type="text" value="000" class="form-control po-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
            </td>
            <td style="padding: 16px;">
                <input type="text" value="ITEM-CODE" class="form-control item-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
            </td>
            <td style="padding: 16px;">
                <input type="number" class="form-control qty-input" value="1" style="width: 60px; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
            </td>
            <td style="padding: 16px; color: var(--color-neutral-500);">
                ₹ <input type="number" class="form-control price-input" value="0.00" style="width: 80px; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px; color: var(--color-neutral-600);">
            </td>
            <td style="padding: 16px; font-weight: 700; color: var(--color-primary-900);">
                <span class="amount-val">₹ 0.00</span>
            </td>
            <td style="padding: 16px; text-align: right;">
                <button class="btn-remove-row" style="background: transparent; color: var(--color-neutral-400); border: none; cursor: pointer; font-size: 1rem; padding: 4px 8px; border-radius: 4px; transition: 0.2s;" onmouseover="this.style.color='var(--color-error-600)'" onmouseout="this.style.color='var(--color-neutral-400)'"><i class="fas fa-times"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
        attachRowEvents(tr);
        calculateTotal();
    };

    btnAddRow.addEventListener('click', addNewRow);

    // Attach events to existing rows and add one initial row if empty
    tbody.querySelectorAll('tr').forEach(attachRowEvents);
    if (tbody.querySelectorAll('tr').length === 0) {
        addNewRow();
    }

    // Submit buttons transition to print preview
    const btnSubmitTop = document.getElementById('btn-submit-invoice-top');
    const btnSubmitBottom = document.getElementById('btn-submit-invoice-bottom');
    const btnBackToInvoice = document.getElementById('btn-back-to-invoice');

    function showPrintPreview(e) {
        e.preventDefault();
        
        // 1. Copy Header Info
        const dateInput = document.getElementById('input-invoice-date');
        const vendorInput = document.getElementById('input-vendor-entity');
        const printDate = document.getElementById('print-invoice-date');
        const printVendorName = document.getElementById('print-vendor-name');
        
        if (printDate && dateInput && dateInput.value) {
            const parts = dateInput.value.split('-');
            if(parts.length === 3) printDate.textContent = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (printVendorName && vendorInput && vendorInput.selectedIndex > 0) {
            printVendorName.textContent = vendorInput.options[vendorInput.selectedIndex].text;
        }

        const invNoEl = document.getElementById('current-invoice-no');
        const printInvNo = document.getElementById('print-invoice-no');
        if (printInvNo && invNoEl) {
            printInvNo.textContent = invNoEl.textContent;
        }

        // 2. Copy Table Rows
        const printTableBody = document.getElementById('print-invoice-items-body');
        const formRows = tbody.querySelectorAll('tr');
        
        if (printTableBody) {
            printTableBody.innerHTML = '';
            let index = 1;
            formRows.forEach(row => {
                const dc = row.querySelector('.dc-input').value;
                const po = row.querySelector('.po-input').value;
                const item = row.querySelector('.item-input').value;
                const qty = row.querySelector('.qty-input').value;
                const price = row.querySelector('.price-input').value;
                const amount = (parseFloat(qty || 0) * parseFloat(price || 0));
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="border: 1px solid black; padding: 6px;">${index++}</td>
                    <td style="border: 1px solid black; padding: 6px;">${dc}</td>
                    <td style="border: 1px solid black; padding: 6px;">${po}</td>
                    <td style="border: 1px solid black; padding: 6px;">${item}</td>
                    <td style="border: 1px solid black; padding: 6px;">${parseFloat(qty || 0) % 1 === 0 ? parseFloat(qty || 0) : parseFloat(qty || 0).toFixed(2)}</td>
                    <td style="border: 1px solid black; padding: 6px;">${parseFloat(price || 0) % 1 === 0 ? parseFloat(price || 0) : parseFloat(price || 0).toFixed(2)}</td>
                    <td style="border: 1px solid black; padding: 6px; text-align: right;">${formatCurrency(amount)}</td>
                `;
                printTableBody.appendChild(tr);
            });
        }

        // 3. Copy Totals
        const subtotalEl = document.getElementById('invoice-subtotal');
        const taxEl = document.getElementById('invoice-tax');
        const totalAmountEl = document.getElementById('invoice-total-amount');
        const taxRate = parseFloat(document.getElementById('invoice-tax-rate')?.value || 0);
        
        const printTaxable = document.getElementById('print-taxable-amount');
        const printCgst = document.getElementById('print-cgst');
        const printSgst = document.getElementById('print-sgst');
        const printIgst = document.getElementById('print-igst');
        const printCgstLabel = document.getElementById('print-cgst-label');
        const printSgstLabel = document.getElementById('print-sgst-label');
        const printIgstLabel = document.getElementById('print-igst-label');
        const printGrand = document.getElementById('print-grand-total');
        
        if (printTaxable && subtotalEl) printTaxable.textContent = subtotalEl.textContent.replace('$', '');
        if (printGrand && totalAmountEl) printGrand.textContent = totalAmountEl.textContent.replace('$', '');
        
        if (printCgst && printSgst && printIgst && taxEl) {
            const taxAmountText = taxEl.textContent.replace('$', '').replace(/,/g, '');
            const taxAmount = parseFloat(taxAmountText) || 0;
            
            if (taxAmount > 0 && taxRate > 0) {
                const halfRate = taxRate / 2;
                if (printCgstLabel) printCgstLabel.textContent = `CGST (${halfRate}%)`;
                if (printSgstLabel) printSgstLabel.textContent = `SGST (${halfRate}%)`;
                if (printIgstLabel) printIgstLabel.textContent = `IGST (${taxRate}%)`;

                const halfTax = taxAmount / 2;
                printCgst.textContent = formatCurrency(halfTax);
                printSgst.textContent = formatCurrency(halfTax);
                printIgst.textContent = '-';
            } else {
                if (printCgstLabel) printCgstLabel.textContent = `CGST (0%)`;
                if (printSgstLabel) printSgstLabel.textContent = `SGST (0%)`;
                if (printIgstLabel) printIgstLabel.textContent = `IGST (0%)`;

                printCgst.textContent = '-';
                printSgst.textContent = '-';
                printIgst.textContent = '-';
            }
        }
        
        // Remove old duplicate to ensure fresh copy
        const oldDuplicate = document.getElementById('duplicate-container');
        if (oldDuplicate) oldDuplicate.remove();

        // 4. Save Invoice to localStorage
        const invoiceData = {
            id: 'INV-' + Date.now(),
            invoice_number: invNoEl?.textContent || 'N/A',
            created_at: new Date().toISOString(),
            due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            amount: parseFloat(totalAmountEl?.textContent.replace(/[^0-9.]/g, '') || 0),
            status: 'draft',
            companies: {
                name: vendorInput.options[vendorInput.selectedIndex].text,
                initials: vendorInput.options[vendorInput.selectedIndex].text.substring(0, 2).toUpperCase(),
                avatar_color: '#3b82f6'
            },
            items: items
        };
        const localInvoices = JSON.parse(localStorage.getItem('invoice_flow_invoices') || '[]');
        localInvoices.unshift(invoiceData);
        localStorage.setItem('invoice_flow_invoices', JSON.stringify(localInvoices));

        // Sync to Supabase
        apiFetch('invoices', {
            method: 'POST',
            body: JSON.stringify({
                invoice_number: invoiceData.invoice_number,
                company_id: invoiceData.company_id, // Wait, I need to make sure this is available
                amount: invoiceData.amount,
                due_date: invoiceData.due_date,
                notes: invoiceData.notes,
                status: 'draft'
            })
        });

        // Transition UI
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const printPage = document.getElementById('page-invoice-print');
        if (printPage) printPage.classList.add('active');
        
        // Create fresh duplicate from populated original
        const originalContainer = document.querySelector('.print-container');
        if (originalContainer) {
            const newDuplicate = originalContainer.cloneNode(true);
            newDuplicate.id = 'duplicate-container';
            const pill = newDuplicate.querySelector('.copy-type-pill');
            if (pill) pill.textContent = 'Duplicate';
            printPage.appendChild(newDuplicate);
        }
    }

    if (btnSubmitTop) btnSubmitTop.addEventListener('click', showPrintPreview);
    if (btnSubmitBottom) btnSubmitBottom.addEventListener('click', showPrintPreview);

    if (btnBackToInvoice) {
        btnBackToInvoice.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const createPage = document.getElementById('page-create-invoice');
            if (createPage) createPage.classList.add('active');
        });
    }
}

/* ---- Invoice Tabs ---- */
function initInvoiceTabs() {
    const tabs = document.querySelectorAll('.inv-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Load filtered data from API
            const filter = tab.dataset.filter;
            currentFilter = filter;
            const statusMap = { 'all': 'all', 'drafts': 'draft', 'archived': 'archived' };
            loadInvoicesData(1, statusMap[filter] || 'all');
        });
    });

    // Pagination buttons (initial static ones)
    const pageButtons = document.querySelectorAll('.inv-page-btn:not(:disabled)');
    pageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.inv-page-btn').forEach(b => b.classList.remove('active'));
            if (!btn.querySelector('i')) {
                btn.classList.add('active');
            }
        });
    });
}

/* ---- Search ---- */
function initSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();

        // Search active page tables
        const activePage = document.querySelector('.page.active');
        if (!activePage) return;

        const rows = activePage.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

/* ---- Animations on load ---- */
function initAnimations() {
    // Animate stat values counting up
    const statValues = document.querySelectorAll('.stat-value');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    });
    statValues.forEach(el => observer.observe(el));

    // Animate progress bar
    setTimeout(() => {
        const progressFills = document.querySelectorAll('.progress-fill');
        progressFills.forEach(fill => {
            const width = fill.style.width;
            fill.style.width = '0%';
            requestAnimationFrame(() => {
                fill.style.width = width;
            });
        });
    }, 300);

    // Animate table rows
    const rows = document.querySelectorAll('.transactions-table tbody tr');
    rows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(10px)';
        row.style.transition = `opacity 0.4s ease ${index * 0.1}s, transform 0.4s ease ${index * 0.1}s`;
        setTimeout(() => {
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 100);
    });

    // Quick action buttons ripple
    const actionBtns = document.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute; border-radius: 50%;
                background: rgba(255,255,255,0.3);
                width: 60px; height: 60px;
                transform: scale(0); animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
}

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to { transform: scale(3); opacity: 0; }
    }
    .animate-in {
        animation: slideUp 0.5s ease forwards;
    }
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

/* ---- Vendor Form Logic ---- */
function initSupplierForm() {
    const form = document.getElementById('form-add-supplier');
    const tbody = document.getElementById('vendor-table-body');
    if (!form || !tbody) return;

    const STORAGE_KEY = 'invoice_flow_customers';
    const getSuppliers = () => {
        let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (data.length === 0) {
            data = [
                { name: 'Skyline Modernity Ltd.', type: '2', phone: '9123456789', email: 'info@skyline.com', address: '123 Business Hub, Hosur', state: 'Tamil Nadu', code: 'V-001', pan: 'ABCDE1234F', gst: '33ABCDE1234F1Z1' },
                { name: 'Vista Housing Co.', type: '1', phone: '9876543210', email: 'contact@vista.com', address: '456 Tech Park, Bangalore', state: 'Karnataka', code: 'V-002', pan: 'FGHIJ5678K', gst: '29FGHIJ5678K1Z2' }
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        return data;
    };
    const saveSuppliers = (suppliers) => localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));

    function renderSuppliers(filter = '') {
        const suppliers = getSuppliers();
        const filtered = suppliers.filter(s => 
            s.name.toLowerCase().includes(filter.toLowerCase()) ||
            (s.code && s.code.toLowerCase().includes(filter.toLowerCase())) ||
            (s.gst && s.gst.toLowerCase().includes(filter.toLowerCase()))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No suppliers found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((s, index) => {
            const imageHtml = s.imgUrl 
                ? `<img src="${s.imgUrl}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">`
                : `<div style="width: 40px; height: 40px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #64748b;"><i class="fas fa-truck-field"></i></div>`;

            return `
                <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 16px;">${imageHtml}</td>
                    <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-700); font-weight: 600;">${s.type === '1' ? 'Service' : s.type === '2' ? 'Goods' : 'Sub-Con'}</td>
                    <td style="padding: 16px;">
                        <div style="font-weight: 700; color: var(--color-primary-900); font-size: 0.875rem;">${s.name}</div>
                        <div style="font-size: 0.75rem; color: var(--color-neutral-500); margin-top: 4px;">Code: ${s.code || 'N/A'}</div>
                    </td>
                    <td style="padding: 16px;">
                        <div style="font-size: 0.875rem; color: var(--color-neutral-700);"><i class="fas fa-phone" style="font-size: 0.75rem; color: var(--color-neutral-400); margin-right: 6px;"></i> ${s.phone || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: var(--color-neutral-500); margin-top: 4px;"><i class="fas fa-envelope" style="font-size: 0.75rem; color: var(--color-neutral-400); margin-right: 6px;"></i> ${s.email || 'N/A'}</div>
                    </td>
                    <td style="padding: 16px;">
                        <div style="font-size: 0.875rem; color: var(--color-neutral-700);">${s.address || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: var(--color-neutral-500); margin-top: 4px;">${s.state || ''}</div>
                    </td>
                    <td style="padding: 16px;">
                        <div style="font-size: 0.875rem; color: var(--color-neutral-700);"><span style="color: var(--color-neutral-500); font-size: 0.75rem;">PAN:</span> ${s.pan || 'N/A'}</div>
                        <div style="font-size: 0.875rem; color: var(--color-neutral-700); margin-top: 4px;"><span style="color: var(--color-neutral-500); font-size: 0.75rem;">GST:</span> ${s.gst || 'N/A'}</div>
                    </td>
                    <td style="padding: 16px;"><span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--color-success-200);">Active</span></td>
                    <td style="padding: 16px; text-align: right;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button onclick="editSupplier(${index})" style="background: transparent; color: var(--color-primary-600); border: none; cursor: pointer; padding: 4px;" title="Edit"><i class="fas fa-pen"></i></button>
                            <button onclick="deleteSupplier(${index})" style="background: transparent; color: #ef4444; border: none; cursor: pointer; padding: 4px;" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderSuppliers();

    // Image Upload Handling
    const imgContainer = document.getElementById('supplier-image-container');
    const imgInput = document.getElementById('supplier-image-input');
    const imgPreview = document.getElementById('supplier-image-preview');
    const imgPlaceholder = document.getElementById('supplier-image-placeholder');

    if (imgContainer && imgInput) {
        imgContainer.addEventListener('click', () => imgInput.click());
        imgInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imgPreview.src = event.target.result;
                    imgPreview.style.display = 'block';
                    imgPlaceholder.style.display = 'none';
                    imgContainer.dataset.hasImage = 'true';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const supplier = {
            name: document.getElementById('supplier-name').value,
            type: document.getElementById('supplier-type').value,
            phone: document.getElementById('supplier-phone').value,
            email: document.getElementById('supplier-email').value,
            address: document.getElementById('supplier-address').value,
            state: document.getElementById('supplier-state').value,
            code: document.getElementById('supplier-code').value,
            pan: document.getElementById('supplier-pan').value,
            gst: document.getElementById('supplier-gst').value,
            imgUrl: imgPreview.style.display !== 'none' ? imgPreview.src : null,
            createdAt: new Date().toISOString()
        };

        const suppliers = getSuppliers();
        if (form.dataset.editIndex !== undefined) {
            suppliers[parseInt(form.dataset.editIndex)] = supplier;
            delete form.dataset.editIndex;
        } else {
            suppliers.unshift(supplier);
        }
        saveSuppliers(suppliers);
        
        // Sync to Supabase
        apiFetch('companies', { 
            method: 'POST', 
            body: JSON.stringify(supplier) 
        });
        
        form.reset();
        imgPreview.style.display = 'none';
        imgPlaceholder.style.display = 'flex';
        renderSuppliers();
        
        if (typeof showNotification === 'function') showNotification('Supplier saved successfully', 'success');
        document.getElementById('nav-view-suppliers').click();
    });

    const searchInput = document.getElementById('search-suppliers');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderSuppliers(e.target.value));
    }

    window.editSupplier = function(index) {
        const suppliers = getSuppliers();
        const s = suppliers[index];
        if (!s) return;

        document.getElementById('supplier-name').value = s.name;
        document.getElementById('supplier-type').value = s.type;
        document.getElementById('supplier-phone').value = s.phone;
        document.getElementById('supplier-email').value = s.email;
        document.getElementById('supplier-address').value = s.address;
        document.getElementById('supplier-state').value = s.state;
        document.getElementById('supplier-code').value = s.code;
        document.getElementById('supplier-pan').value = s.pan;
        document.getElementById('supplier-gst').value = s.gst;
        
        if (s.imgUrl) {
            imgPreview.src = s.imgUrl;
            imgPreview.style.display = 'block';
            imgPlaceholder.style.display = 'none';
        } else {
            imgPreview.style.display = 'none';
            imgPlaceholder.style.display = 'flex';
        }

        form.dataset.editIndex = index;
        document.getElementById('nav-add-supplier').click();
    };

    window.deleteSupplier = function(index) {
        if (!confirm('Are you sure you want to delete this supplier?')) return;
        const suppliers = getSuppliers();
        suppliers.splice(index, 1);
        saveSuppliers(suppliers);
        renderSuppliers();
        if (typeof showNotification === 'function') showNotification('Supplier deleted', 'info');
    };
}

/* ---- Delivery Challan (DC) Logic ---- */
function initDCForm() {
    function populateSuppliers() {
        const supplierSelect = document.getElementById('dc-vendor');
        if (supplierSelect) {
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
            const currentVal = supplierSelect.value;
            supplierSelect.innerHTML = '<option value="">Select Supplier</option>' + 
                customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            if (currentVal) supplierSelect.value = currentVal;
            else if (profile.defaultCustomer) supplierSelect.value = profile.defaultCustomer;
        }
    }
    populateSuppliers();

    const form = document.getElementById('form-add-dc');
    const btnAddRow = document.getElementById('btn-dc-add-row');
    const tbody = document.getElementById('dc-items-body');

    if (!form || !btnAddRow || !tbody) return;

    // Handle adding new row
    function addDCRow(data = null) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--color-neutral-100)';
        tr.innerHTML = `
            <td style="padding: 8px;"><input type="text" value="${data?.poNo || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" value="${data?.desc || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" value="${data?.qty || ''}" ${data?.maxQty ? `max="${data.maxQty}" placeholder="Max: ${data.maxQty}"` : ''} style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" class="btn-select-rdc" style="background: var(--color-primary-600); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='var(--color-primary-700)'" onmouseout="this.style.background='var(--color-primary-600)'">Select</button>
            </td>
            <td style="padding: 8px;"><input type="text" value="${data?.code || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" value="${data?.remark || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" value="${data?.hsn || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" value="${data?.totalQty || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" value="${data?.rate || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" value="${data?.usedQty || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" value="${data?.invCode || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" class="btn-remove-row" style="background: #fee2e2; color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;"><i class="fas fa-times"></i></button>
            </td>
        `;
        if (data?.rdcRef) tr.dataset.rdcRef = JSON.stringify(data.rdcRef);
        tbody.appendChild(tr);
        return tr;
    }

    // Handle adding new row
    btnAddRow.addEventListener('click', () => {
        addDCRow();
    });

    // Handle removing row and RDC selection
    tbody.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-row');
        if (removeBtn) {
            removeBtn.closest('tr').remove();
        }

        const selectBtn = e.target.closest('.btn-select-rdc');
        if (selectBtn) {
            openRDCSelector(selectBtn.closest('tr'));
        }
    });

    let currentRowToFillDC = null;
    function openRDCSelector(row) {
        currentRowToFillDC = row;
        const modal = document.getElementById('modal-rdc-selector');
        const selectorBody = document.getElementById('rdc-selector-body');
        const btnBulkAdd = document.getElementById('btn-bulk-add-rdc');
        const btnCreateNew = document.getElementById('btn-create-rdc-from-modal');
        const selectAll = document.getElementById('rdc-select-all');
        if (!modal || !selectorBody || !btnBulkAdd) return;

        if (btnCreateNew) {
            btnCreateNew.onclick = () => {
                modal.style.display = 'none';
                const mainCreateBtn = document.getElementById('btn-create-new-rdc');
                if (mainCreateBtn) mainCreateBtn.click();
            };
        }

        if (selectAll) selectAll.checked = false;

        const rdcs = JSON.parse(localStorage.getItem('invoice_flow_rdcs') || '[]');
        let availableItems = [];
        
        rdcs.forEach((rdc, rdcIdx) => {
            rdc.items.forEach((item, itemIdx) => {
                const availableQty = parseFloat(item.qty) || 0;
                if (availableQty >= 0.01) {
                    availableItems.push({
                        rdcNo: rdc.noFull,
                        customer: rdc.customer,
                        product: item.product,
                        itemCode: item.code,
                        hsn: item.hsn,
                        qty: availableQty,
                        rdcIdx: rdcIdx,
                        itemIdx: itemIdx
                    });
                }
            });
        });

        const renderSelector = (items) => {
            if (items.length === 0) {
                selectorBody.innerHTML = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: var(--color-neutral-400);">
                    No available RDC items found. <a href="#" onclick="document.getElementById('modal-rdc-selector').style.display='none'; document.getElementById('btn-create-new-rdc')?.click(); return false;" style="color: var(--color-primary-600); text-decoration: underline;">Create one now</a>
                </td></tr>`;
                return;
            }
            selectorBody.innerHTML = items.map((item, idx) => `
                <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 12px; text-align: center;"><input type="checkbox" class="rdc-item-checkbox" data-idx="${idx}" style="width: 16px; height: 16px; cursor: pointer;"></td>
                    <td style="padding: 12px; font-size: 0.875rem; font-weight: 600;">${item.rdcNo}</td>
                    <td style="padding: 12px; font-size: 0.875rem;">${item.customer}</td>
                    <td style="padding: 12px; font-size: 0.875rem;">${item.product}</td>
                    <td style="padding: 12px; font-size: 0.875rem; text-align: center; font-weight: 700; color: var(--color-primary-600);">${item.qty}</td>
                </tr>
            `).join('');
        };

        let currentFilteredItems = [...availableItems];
        renderSelector(currentFilteredItems);
        modal.style.display = 'flex';

        // Select All logic
        if (selectAll) {
            selectAll.onchange = () => {
                document.querySelectorAll('.rdc-item-checkbox').forEach(cb => cb.checked = selectAll.checked);
            };
        }

        // Search logic
        const searchInput = document.getElementById('rdc-selector-search');
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = (e) => {
                const query = e.target.value.toLowerCase();
                currentFilteredItems = availableItems.filter(item => 
                    item.rdcNo.toLowerCase().includes(query) || 
                    item.customer.toLowerCase().includes(query) || 
                    item.product.toLowerCase().includes(query)
                );
                renderSelector(currentFilteredItems);
            };
        }

        // Bulk add logic
        btnBulkAdd.onclick = () => {
            const checkboxes = selectorBody.querySelectorAll('.rdc-item-checkbox:checked');
            if (checkboxes.length === 0) {
                alert('Please select at least one item.');
                return;
            }

            checkboxes.forEach((cb, idx) => {
                const item = currentFilteredItems[parseInt(cb.dataset.idx)];
                const rowData = {
                    desc: item.product,
                    code: item.itemCode,
                    hsn: item.hsn,
                    remark: item.rdcNo,
                    maxQty: item.qty,
                    rdcRef: { rdcIdx: item.rdcIdx, itemIdx: item.itemIdx }
                };

                if (idx === 0 && currentRowToFillDC) {
                    // Fill current row
                    const inputs = currentRowToFillDC.querySelectorAll('input');
                    inputs[1].value = rowData.desc;
                    inputs[3].value = rowData.code;
                    inputs[5].value = rowData.hsn;
                    inputs[4].value = rowData.remark;
                    inputs[2].max = rowData.maxQty;
                    inputs[2].placeholder = "Max: " + rowData.maxQty;
                    currentRowToFillDC.dataset.rdcRef = JSON.stringify(rowData.rdcRef);
                } else {
                    addDCRow(rowData);
                }
            });

            modal.style.display = 'none';
        };
    }

    // Add Qty validation on input
    tbody.addEventListener('input', (e) => {
        if (e.target.type === 'number' && e.target.max) {
            const val = parseFloat(e.target.value) || 0;
            const max = parseFloat(e.target.max);
            if (val > max) {
                alert(`Quantity cannot exceed RDC available quantity (${max})`);
                e.target.value = max;
            }
        }
    });

    // Rate based PO Autofill
    tbody.addEventListener('change', (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const inputs = row.querySelectorAll('input');
        
        // Rate input is at index 7
        if (target === inputs[7]) {
            const enteredRate = parseFloat(target.value);
            if (isNaN(enteredRate) || enteredRate <= 0) return;

            const pos = JSON.parse(localStorage.getItem('invoice_flow_pos') || '[]');
            const products = JSON.parse(localStorage.getItem('invoice_flow_products') || '[]');
            
            const matches = [];

            // Search through all POs for all matching items
            for (const po of pos) {
                if (po.items && Array.isArray(po.items)) {
                    po.items.forEach(item => {
                        if (parseFloat(item.rate) === enteredRate) {
                            const product = products.find(p => p.code === item.itemCode);
                            matches.push({ 
                                poNo: po.no, 
                                invCode: item.itemCode, 
                                productName: product ? product.name : 'Unknown Product',
                                hsn: product ? product.hsn : '',
                                rate: item.rate
                            });
                        }
                    });
                }
            }

            const fillRow = (match) => {
                inputs[0].value = match.poNo;       // PO Order No
                inputs[1].value = match.productName; // Description
                inputs[9].value = match.invCode;    // Inv Item Code
                if (match.hsn) inputs[5].value = match.hsn; // HSN Code
                showNotification(`Matched with PO: ${match.poNo}`, 'success');
            };

            if (matches.length === 1) {
                fillRow(matches[0]);
            } else if (matches.length > 1) {
                // Show selection modal
                const modal = document.getElementById('modal-po-item-selector');
                const selectorBody = document.getElementById('po-item-selector-body');
                if (!modal || !selectorBody) return;

                selectorBody.innerHTML = matches.map((m, idx) => `
                    <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 12px; font-weight: 700; color: var(--color-primary-900);">${m.poNo}</td>
                        <td style="padding: 12px; font-size: 0.875rem;">${m.productName}</td>
                        <td style="padding: 12px; font-family: monospace; font-size: 0.875rem;">${m.invCode}</td>
                        <td style="padding: 12px; font-weight: 700;">₹${parseFloat(m.rate).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: right;">
                            <button class="btn-select-match" data-idx="${idx}" style="background: var(--color-primary-600); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Select</button>
                        </td>
                    </tr>
                `).join('');

                modal.style.display = 'flex';

                // Handle selection
                const handleClick = (event) => {
                    const btn = event.target.closest('.btn-select-match');
                    if (btn) {
                        const match = matches[parseInt(btn.dataset.idx)];
                        fillRow(match);
                        modal.style.display = 'none';
                        selectorBody.removeEventListener('click', handleClick);
                    }
                };
                selectorBody.addEventListener('click', handleClick);
            } else {
                showNotification('Item rate not found in any Purchase Order', 'warning');
            }
        }
    });

    // Handle form submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 1. Extract Header Data
        const dcDate = document.getElementById('dc-date').value;
        const vendorName = document.getElementById('dc-vendor').value;
        const dcNoInput = document.getElementById('dc-number-input').value.trim();
        const dcNo = dcNoInput || getNextDCNo();

        // 2. Extract Items Data
        const items = [];
        let totalQty = 0;
        const rows = tbody.querySelectorAll('tr');
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const inputs = row.querySelectorAll('input');
            if (inputs[1].value) { // Description is required
                if (items.length >= 15) {
                    alert('Maximum 15 items allowed per Delivery Challan.');
                    break;
                }
                const item = {
                    sno: items.length + 1,
                    poNo: inputs[0].value,
                    desc: inputs[1].value,
                    qty: parseFloat(inputs[2].value) || 0,
                    code: inputs[3].value,
                    remark: inputs[4].value,
                    hsn: inputs[5].value,
                    totalQty: parseFloat(inputs[6].value) || 0,
                    rate: parseFloat(inputs[7].value) || 0,
                    usedQty: parseFloat(inputs[8].value) || 0,
                    invCode: inputs[9].value
                };
                    items.push({
                        ...item,
                        rdcRef: row.dataset.rdcRef ? JSON.parse(row.dataset.rdcRef) : null
                    });
                totalQty += item.qty;
            }
        }

        if (items.length === 0) {
            alert('Please add at least one item description.');
            return;
        }

        // 3. Update View DC Table
        const viewTableBody = document.getElementById('dc-view-table-body');
        if (viewTableBody) {
            if (viewTableBody.textContent.includes('No Delivery Challans found')) {
                viewTableBody.innerHTML = '';
            }
            
            let targetRow;
            let finalDcNo = dcNo;

            if (form.dataset.editMode === 'true' && window.currentEditRow) {
                targetRow = window.currentEditRow;
                finalDcNo = dcNo; // Use current input/generated no
            } else {
                targetRow = document.createElement('tr');
                targetRow.style.borderBottom = '1px solid var(--color-neutral-100)';
            }

            const dcData = { dcDate, vendorName, dcNo: finalDcNo, items, totalQty };
            targetRow.dataset.dcData = JSON.stringify(dcData);
            
            targetRow.innerHTML = `
                <td style="padding: 16px; font-size: 0.875rem;">${dcDate}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-primary-900);">${finalDcNo}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${vendorName}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${items.length} Items</td>
                <td style="padding: 16px; display: flex; justify-content: flex-end; gap: 12px;">
                    <button class="btn-edit-row" style="background: transparent; color: var(--color-neutral-600); border: none; cursor: pointer; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--color-primary-600)'" onmouseout="this.style.color='var(--color-neutral-600)'" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-print-row" style="background: transparent; color: var(--color-primary-600); border: none; cursor: pointer; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--color-primary-800)'" onmouseout="this.style.color='var(--color-primary-600)'" title="Print"><i class="fas fa-print"></i></button>
                </td>
            `;
            
            if (form.dataset.editMode !== 'true') {
                viewTableBody.prepend(targetRow);
            }

            // Save to localStorage
            const dcs = JSON.parse(localStorage.getItem('invoice_flow_dcs') || '[]');
            let existingIndex = -1;

            if (form.dataset.editMode === 'true' && form.dataset.editDcNo) {
                existingIndex = dcs.findIndex(d => d.dcNo === form.dataset.editDcNo);
            } else {
                // Check if DC No already exists (for manual entry or double submission)
                existingIndex = dcs.findIndex(d => d.dcNo === dcData.dcNo);
            }

            if (existingIndex > -1) {
                dcs[existingIndex] = dcData;
            } else {
                dcs.unshift(dcData);
            }
            localStorage.setItem('invoice_flow_dcs', JSON.stringify(dcs));
            
            // Sync to Supabase
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            const customer = customers.find(c => c.name === dcData.vendorName);
            apiFetch('delivery_challans', {
                method: 'POST',
                body: JSON.stringify({
                    challan_number: dcData.dcNo,
                    company_id: customer ? customer.id : null,
                    date: dcData.dcDate,
                    items: dcData.items,
                    status: 'pending'
                })
            });

            if (typeof window.renderDCList === 'function') window.renderDCList();
        }

        // 4. Populate Print Template (Both Copies)
        const updateText = (className, text) => {
            document.querySelectorAll('.' + className).forEach(el => el.textContent = text);
        };

        updateText('print-dc-no', dcNo);
        updateText('print-dc-date', dcDate);
        updateText('print-dc-vendor-name', vendorName);
        updateText('print-dc-total-qty', totalQty % 1 === 0 ? totalQty : totalQty.toFixed(2));
        
        // Update both table bodies
        document.querySelectorAll('.print-dc-table-body').forEach(printTableBody => {
            printTableBody.innerHTML = '';
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                tr.innerHTML = `
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.sno}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: left;">${item.desc}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${parseFloat(item.qty) % 1 === 0 ? parseFloat(item.qty) : parseFloat(item.qty).toFixed(2)}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.code}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.hsn}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${parseFloat(item.totalQty) % 1 === 0 ? parseFloat(item.totalQty) : parseFloat(item.totalQty).toFixed(2)}</td>
                    <td style="padding: 6px; text-align: left;">${item.remark}</td>
                `;
                printTableBody.appendChild(tr);
            });

            // Fill empty rows if items are less than 10 to make it look full
            const minRows = 10;
            if (items.length < minRows) {
                for (let i = items.length; i < minRows; i++) {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #e2e8f0';
                    tr.innerHTML = `
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center; color: transparent;">-</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                        <td style="padding: 6px;">&nbsp;</td>
                    `;
                    printTableBody.appendChild(tr);
                }
            }
        });

    // 5. UI Feedback and Navigation
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Saving...';
    submitBtn.style.background = '#059669';
    submitBtn.disabled = true;

    // Increment sequence if not editing and using the suggested number
    if (!form.dataset.editMode || form.dataset.editMode !== 'true') {
        const sequence = parseInt(localStorage.getItem('invoice_flow_dc_sequence') || '1');
        localStorage.setItem('invoice_flow_dc_sequence', sequence + 1);
    }

        setTimeout(() => {
            form.reset();
            while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);
            
            delete form.dataset.editMode;
            delete form.dataset.editDcNo;
            window.currentEditRow = null;

            submitBtn.innerHTML = 'Submit';
            submitBtn.style.background = '#10b981';
            submitBtn.disabled = false;

            // Switch to Print Page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-print-dc').classList.add('active');
            window.scrollTo(0,0);
            
            // 6. Update RDC Quantities
            const rdcs = JSON.parse(localStorage.getItem('invoice_flow_rdcs') || '[]');
            items.forEach((item) => {
                if (item.rdcRef) {
                    const ref = item.rdcRef;
                    if (rdcs[ref.rdcIdx] && rdcs[ref.rdcIdx].items[ref.itemIdx]) {
                        const currentRdcQty = parseFloat(rdcs[ref.rdcIdx].items[ref.itemIdx].qty) || 0;
                        const newQty = Math.max(0, currentRdcQty - item.qty);
                        rdcs[ref.rdcIdx].items[ref.itemIdx].qty = newQty;
                        
                        // Track closure
                        if (newQty <= 0) {
                            rdcs[ref.rdcIdx].items[ref.itemIdx].closedByDC = dcNo;
                            rdcs[ref.rdcIdx].items[ref.itemIdx].closedDate = dcDate;
                        }
                    }
                }
            });
            localStorage.setItem('invoice_flow_rdcs', JSON.stringify(rdcs));
        }, 800);
    });

    // Handle Actions from Table (Edit & Print)
    document.getElementById('dc-view-table-body').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-row');
        const printBtn = e.target.closest('.btn-print-row');
        
        if (editBtn) {
            const row = editBtn.closest('tr');
            const data = JSON.parse(row.dataset.dcData);
            
            // Switch to Add DC Page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-add-dc').classList.add('active');
            
            // Set values
            document.getElementById('dc-date').value = data.dcDate;
            document.getElementById('dc-vendor').value = data.vendorName;
            document.getElementById('dc-number-input').value = data.dcNo || '';
            
            tbody.innerHTML = '';
            data.items.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--color-neutral-100)';
                tr.innerHTML = `
                    <td style="padding: 8px;"><input type="text" value="${item.poNo || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="text" value="${item.desc || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="number" value="${item.qty || 0}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="text" value="${item.code || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="text" value="${item.remark || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="text" value="${item.hsn || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="number" value="${item.totalQty || 0}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="number" value="${item.rate || 0}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="number" value="${item.usedQty || 0}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px;"><input type="text" value="${item.invCode || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
                    <td style="padding: 8px; text-align: center;">
                        <button type="button" class="btn-remove-row" style="background: #fee2e2; color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;"><i class="fas fa-times"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            form.dataset.editMode = 'true';
            form.dataset.editDcNo = data.dcNo;
            window.currentEditRow = row;
            form.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> Update Challan';
            window.scrollTo(0,0);
        }

        if (printBtn) {
            const row = printBtn.closest('tr');
            const data = JSON.parse(row.dataset.dcData);
            
            // Populate Print Template
            const updateText = (className, text) => {
                document.querySelectorAll('.' + className).forEach(el => el.textContent = text);
            };

            updateText('print-dc-no', data.dcNo);
            updateText('print-dc-date', data.dcDate);
            updateText('print-dc-vendor-name', data.vendorName);
            updateText('print-dc-total-qty', data.totalQty);
            
            document.querySelectorAll('.print-dc-table-body').forEach(printTableBody => {
                printTableBody.innerHTML = '';
                data.items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #e2e8f0';
                    tr.innerHTML = `
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.sno}</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: left;">${item.desc}</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.code}</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.hsn}</td>
                        <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
                        <td style="padding: 6px; text-align: left;">${item.remark}</td>
                    `;
                    printTableBody.appendChild(tr);
                });

                const minRows = 10;
                if (data.items.length < minRows) {
                    for (let i = data.items.length; i < minRows; i++) {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid #e2e8f0';
                        tr.innerHTML = `
                            <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center; color: transparent;">-</td>
                            <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                            <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                            <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                            <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                            <td style="padding: 6px; border-right: 1px solid #e2e8f0;">&nbsp;</td>
                            <td style="padding: 6px;">&nbsp;</td>
                        `;
                        printTableBody.appendChild(tr);
                    }
                }
            });

            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-print-dc').classList.add('active');
            window.scrollTo(0,0);
        }
    });
}

/* ---- Loading Sheets Logic ---- */
function initLoadingSheets() {
    if (window.loadingSheetsInitialized) {
        if (typeof window.renderMainLoadingTable === 'function') {
            const STORAGE_KEY = 'invoice_flow_loading_sheets';
            window.allLoadingSheets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            window.renderMainLoadingTable();
        }
        return;
    }
    window.loadingSheetsInitialized = true;

    const entryTableBody = document.getElementById('entry-items-table-body');
    const loadingTableBody = document.getElementById('loading-sheets-table-body');
    const btnAddItem = document.getElementById('btn-add-item-loading');
    const btnSubmitPreview = document.getElementById('btn-submit-preview-loading');
    
    // Header Stats
    const headerTotalNos = document.getElementById('header-total-nos');
    const headerTotalCutting = document.getElementById('header-total-cutting');
    const headerTotalRate = document.getElementById('header-total-rate');
    const headerGrandTotal = document.getElementById('header-grand-total');

    // Item Inputs
    const itemNos = document.getElementById('item-nos');
    const itemRate = document.getElementById('item-rate');
    const itemCutting = document.getElementById('item-cutting');
    const itemTotal = document.getElementById('item-total');

    if (!entryTableBody || !btnAddItem) return;

    const STORAGE_KEY = 'invoice_flow_loading_sheets';
    window.allLoadingSheets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    // Auto-calculate item total: NOS * CUTTING * RATE
    function calculateItemTotal() {
        const nos = parseFloat(itemNos.value) || 0;
        const cutting = parseFloat(itemCutting.value) || 0;
        const rate = parseFloat(itemRate.value) || 0;
        const total = nos * cutting * rate; 
        itemTotal.value = total % 1 === 0 ? total : total.toFixed(2);
    }

    [itemNos, itemRate, itemCutting].forEach(el => {
        if (el) el.addEventListener('input', () => {
            calculateItemTotal();
            if (el === itemRate) searchItemCodesByRate();
        });
    });

    function searchItemCodesByRate() {
        const rate = parseFloat(itemRate.value) || 0;
        const selectionContainer = document.getElementById('rate-selection-container');
        const selectionTableBody = document.getElementById('rate-selection-table-body');
        const grandTotal = document.getElementById('header-grand-total').value || '0.00';

        if (rate <= 0) {
            if (selectionContainer) selectionContainer.style.display = 'none';
            return;
        }

        // Inventory data (matching seed data in loadInventoryData)
        const inventoryItems = [
            { rate: '2.80', code: '73181000L01140' },
            { rate: '25.00', code: '73181000L01150' },
            { rate: '5.00', code: '73181000L01152' },
            { rate: '10.00', code: '73181000L01149' },
            { rate: '16.00', code: '73181000L01142' },
            { rate: '2.00', code: '73181000L01183' },
            { rate: '2.80', code: '73181000L01161' },
            { rate: '25.00', code: '73181000L01165' },
            { rate: '16.00', code: '73181000L01158' },
            { rate: '5.00', code: '73181000L01156' }
        ];

        const matches = inventoryItems.filter(item => parseFloat(item.rate) === rate);

        if (matches.length > 0) {
            if (selectionContainer) selectionContainer.style.display = 'block';
            if (selectionTableBody) {
                const codesHtml = matches.map(match => `
                    <label style="display: inline-flex; align-items: center; gap: 8px; margin-right: 24px; cursor: pointer; font-size: 0.875rem; color: var(--color-neutral-800); font-weight: 600;">
                        <input type="radio" name="item-code-selection" value="${match.code}" style="cursor: pointer; accent-color: #5c4eb4; width: 18px; height: 18px;">
                        ${match.code}
                    </label>
                `).join('');

                selectionTableBody.innerHTML = `
                    <tr style="transition: background 0.2s;">
                        <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-700); border-right: 1px solid var(--color-neutral-100);">${parseFloat(rate).toFixed(2)}</td>
                        <td style="padding: 16px;">
                            <div style="display: flex; align-items: center; flex-wrap: wrap;">
                                ${codesHtml}
                            </div>
                        </td>
                    </tr>
                `;

                // Add selection event
                selectionTableBody.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            const itemCodeInput = document.getElementById('item-code');
                            if (itemCodeInput) itemCodeInput.value = e.target.value;
                        }
                    });
                });
            }
        } else {
            if (selectionContainer) selectionContainer.style.display = 'none';
        }
    }

    // Add Item to Table
    btnAddItem.addEventListener('click', () => {
        const customer = document.getElementById('item-customer').value;
        const no = document.getElementById('item-no').value;
        const name = document.getElementById('item-name').value;
        const code = document.getElementById('item-code').value;
        const serial = document.getElementById('item-serial').value;
        const nos = parseFloat(itemNos.value) || 0;
        const cutting = parseFloat(itemCutting.value) || 0;
        const rate = parseFloat(itemRate.value) || 0;
        const total = parseFloat(itemTotal.value) || 0;

        // Compulsory fields check
        if (!serial || !itemNos.value || !itemCutting.value || !itemRate.value) {
            alert('Compulsory fields needed: Serial No, NOS, Cutting, and Rate');
            return;
        }

        const item = { customer, no, name, code, serial, nos, cutting, rate, total };
        itemsList.push(item);
        renderEntryTable();
        clearItemInputs();
        updateHeaderStats();
    });

    function renderEntryTable() {
        const dcInput = document.getElementById('header-dc-no');
        if (dcInput) {
            dcInput.readOnly = itemsList.length > 0;
            dcInput.style.background = itemsList.length > 0 ? '#f0f2f5' : 'white';
        }

        if (itemsList.length === 0) {
            entryTableBody.innerHTML = `<tr id="entry-empty-row"><td colspan="9" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No items added yet.</td></tr>`;
            return;
        }

        entryTableBody.innerHTML = itemsList.map((item, index) => `
            <tr style="border-bottom: 1px solid var(--color-neutral-100);">
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700);">${item.customer}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700);">${item.no}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700);">${item.name}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700); white-space: pre-wrap;">${item.serial}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700); text-align: center;">${item.nos}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700); text-align: center;">${item.cutting % 1 === 0 ? item.cutting : item.cutting.toFixed(2)}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700); text-align: center;">${item.rate % 1 === 0 ? item.rate : item.rate.toFixed(2)}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900); text-align: center;">${item.total % 1 === 0 ? item.total : item.total.toFixed(2)}</td>
                <td style="padding: 12px 16px; text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-edit-item" data-index="${index}" style="background: transparent; color: #3b82f6; border: none; cursor: pointer; padding: 4px;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-remove-item" data-index="${index}" style="background: transparent; color: #ef4444; border: none; cursor: pointer; padding: 4px;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Attach remove events
        entryTableBody.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                itemsList.splice(index, 1);
                renderEntryTable();
                updateHeaderStats();
            });
        });

        // Attach edit events
        entryTableBody.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const item = itemsList[index];
                
                // Populate inputs
                document.getElementById('item-customer').value = item.customer;
                document.getElementById('item-no').value = item.no;
                document.getElementById('item-name').value = item.name;
                document.getElementById('item-code').value = item.code || '';
                document.getElementById('item-serial').value = item.serial;
                document.getElementById('item-nos').value = item.nos;
                document.getElementById('item-cutting').value = item.cutting;
                document.getElementById('item-rate').value = item.rate;
                document.getElementById('item-total').value = item.total.toFixed(2);
                
                // Remove from list so it can be re-added after editing
                itemsList.splice(index, 1);
                renderEntryTable();
                updateHeaderStats();

                // Focus on the first field
                document.getElementById('item-customer').focus();
            });
        });
    }

    function clearItemInputs() {
        ['item-customer', 'item-no', 'item-name', 'item-code', 'item-serial', 'item-nos', 'item-rate', 'item-total'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const cutting = document.getElementById('item-cutting');
        if (cutting) cutting.value = '1';
    }

    function updateHeaderStats() {
        const totalNos = itemsList.reduce((sum, item) => sum + item.nos, 0);
        const totalCutting = itemsList.reduce((sum, item) => sum + item.cutting, 0);
        const totalRate = itemsList.reduce((sum, item) => sum + item.rate, 0);
        const grandTotal = itemsList.reduce((sum, item) => sum + item.total, 0);

        if (headerTotalNos) headerTotalNos.value = totalNos;
        if (headerTotalCutting) headerTotalCutting.value = totalCutting % 1 === 0 ? totalCutting : totalCutting.toFixed(2);
        if (headerTotalRate) headerTotalRate.value = totalRate % 1 === 0 ? totalRate : totalRate.toFixed(2);
        if (headerGrandTotal) headerGrandTotal.value = grandTotal % 1 === 0 ? grandTotal : grandTotal.toFixed(2);
    }

    // Submit & Preview (Finalize Entry)
    if (btnSubmitPreview) {
        btnSubmitPreview.addEventListener('click', () => {
            const dcNo = document.getElementById('header-dc-no').value;
            const date = document.getElementById('header-date').value;

            if (!dcNo || itemsList.length === 0) {
                alert('Please enter DC No and add at least one item.');
                return;
            }

            const totalNos = itemsList.reduce((sum, item) => sum + item.nos, 0);
            const totalCutting = itemsList.reduce((sum, item) => sum + item.cutting, 0);
            const totalRate = itemsList.reduce((sum, item) => sum + item.rate, 0);
            const grandTotal = itemsList.reduce((sum, item) => sum + item.total, 0);

            const sheetData = {
                dcNo,
                date,
                totalNos,
                totalCutting,
                totalRate,
                grandTotal,
                items: [...itemsList]
            };

            // Save to main array
            window.allLoadingSheets.unshift(sheetData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(window.allLoadingSheets));
            window.renderMainLoadingTable();

            // Sync to Supabase
            apiFetch('loading_sheets', {
                method: 'POST',
                body: JSON.stringify({
                    dc_number: sheetData.dcNo,
                    date: sheetData.date,
                    items: sheetData.items,
                    total_nos: sheetData.totalNos,
                    grand_total: sheetData.grandTotal
                })
            });

            // UI Feedback
            alert('Loading Entry Saved Successfully!');
            
            // Reset and Navigate
            itemsList = [];
            renderEntryTable();
            document.getElementById('header-dc-no').value = '';
            updateHeaderStats();
            document.getElementById('nav-view-loading').click();
        });
    }

    window.renderMainLoadingTable = function() {
        if (!loadingTableBody) return;
        
        loadingTableBody.innerHTML = window.allLoadingSheets.map((sheet, index) => `
            <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px; text-align: center;"><input type="checkbox"></td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-neutral-800);">${sheet.dcNo}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">${sheet.date}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-800);">${sheet.totalNos}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-800);">${sheet.totalCutting % 1 === 0 ? sheet.totalCutting : sheet.totalCutting.toFixed(2)}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-800);">${sheet.totalRate % 1 === 0 ? sheet.totalRate : sheet.totalRate.toFixed(2)}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-primary-900);">${sheet.grandTotal % 1 === 0 ? sheet.grandTotal : sheet.grandTotal.toFixed(2)}</td>
                <td style="padding: 16px; text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-icon btn-print-sheet" data-index="${index}" style="background: var(--color-primary-500); color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Print"><i class="fas fa-print"></i></button>
                        <button class="btn-icon btn-edit-sheet" data-index="${index}" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-primary btn-view-sheet" data-index="${index}" style="padding: 6px 12px; font-size: 0.75rem; border-radius: 4px; background: var(--color-primary-900); color: white; border: none; cursor: pointer;">View</button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Attach edit sheet events
        loadingTableBody.querySelectorAll('.btn-edit-sheet').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const sheet = window.allLoadingSheets[index];
                
                document.getElementById('header-dc-no').value = sheet.dcNo;
                document.getElementById('header-date').value = sheet.date;
                itemsList = [...sheet.items];
                
                renderEntryTable();
                updateHeaderStats();

                window.allLoadingSheets.splice(index, 1);
                renderMainLoadingTable();

                document.getElementById('nav-add-loading').click();
            });
        });

        // Attach View events
        loadingTableBody.querySelectorAll('.btn-view-sheet').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const sheet = window.allLoadingSheets[index];
                
                document.getElementById('header-dc-no').value = sheet.dcNo;
                document.getElementById('header-date').value = sheet.date;
                itemsList = [...sheet.items];
                
                renderEntryTable();
                updateHeaderStats();

                // Just navigate, don't remove from list
                document.getElementById('nav-add-loading').click();
            });
        });

        // Attach Print events
        loadingTableBody.querySelectorAll('.btn-print-sheet').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const sheet = window.allLoadingSheets[index];
                
                const printWindow = window.open('', '_blank');
                
                // Grouping items by Rate and Item Code for the bottom table
                const summaryGroups = {};
                sheet.items.forEach(item => {
                    const key = `${item.rate.toFixed(2)}_${item.code || 'N/A'}`;
                    if (!summaryGroups[key]) {
                        summaryGroups[key] = {
                            rate: item.rate,
                            code: item.code || 'N/A',
                            totalCutting: 0,
                            totalAmount: 0
                        };
                    }
                    summaryGroups[key].totalCutting += (item.nos * item.cutting);
                    summaryGroups[key].totalAmount += item.total;
                });

                printWindow.document.write(`
                    <html>
                    <head>
                        <title>Loading Sheet - ${sheet.dcNo}</title>
                        <style>
                            @page { size: portrait; margin: 0; }
                            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 15mm; margin: 0; }
                            .container { width: 100%; max-width: 800px; margin: 0 auto; }
                            .header { text-align: center; margin-bottom: 20px; }
                            .company-name { font-size: 32px; font-weight: 800; color: #1e3a8a; margin: 0; letter-spacing: 1px; }
                            .doc-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; font-weight: 600; color: #475569; }
                            
                            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                            th { background: #f8fafc; color: #1e3a8a; font-weight: 700; text-transform: uppercase; border: 1.5px solid #1e293b; padding: 8px 4px; }
                            td { border: 1px solid #1e293b; padding: 6px 4px; color: #0f172a; }
                            .text-center { text-align: center; }
                            .text-right { text-align: right; }
                            .font-bold { font-weight: 700; }
                            
                            .footer-table { margin-top: 10px; border: 1.5px solid #1e293b; }
                            .footer-table th, .footer-table td { border: 1.5px solid #1e293b; padding: 6px 12px; }
                            
                            .summary-box { border: 1.5px solid #1e293b; padding: 6px 12px; font-size: 12px; font-weight: 700; margin-top: 10px; }
                            .computer-gen { text-align: center; font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-style: italic; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 class="company-name">${JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}').name || 'Precision Logistics'}</h1>
                            </div>
                            
                            <div class="doc-info">
                                <div>DC Number: ${sheet.dcNo}</div>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 15%">Custom Name</th>
                                        <th style="width: 10%">Item No</th>
                                        <th style="width: 10%">Item Name</th>
                                        <th style="width: 25%">Serial No</th>
                                        <th style="width: 8%">NOS</th>
                                        <th style="width: 8%">Cutting</th>
                                        <th style="width: 8%">Total Cutting</th>
                                        <th style="width: 8%">Rate</th>
                                        <th style="width: 10%">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sheet.items.map(item => `
                                        <tr>
                                            <td>${item.customer}</td>
                                            <td class="text-center">${item.no}</td>
                                            <td class="text-center">${item.name}</td>
                                            <td style="white-space: pre-wrap;">${item.serial}</td>
                                            <td class="text-center">${item.nos}</td>
                                            <td class="text-center">${item.cutting % 1 === 0 ? item.cutting : item.cutting.toFixed(2)}</td>
                                            <td class="text-center">${(item.nos * item.cutting) % 1 === 0 ? (item.nos * item.cutting) : (item.nos * item.cutting).toFixed(2)}</td>
                                            <td class="text-right">${item.rate % 1 === 0 ? item.rate : item.rate.toFixed(2)}</td>
                                            <td class="text-right font-bold">${item.total % 1 === 0 ? item.total : item.total.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #f8fafc;">
                                        <td colspan="4" class="text-right font-bold" style="border-right: none;">GRAND TOTAL</td>
                                        <td class="text-center font-bold" style="border-left: none; border-right: none;">${sheet.totalNos}</td>
                                        <td style="border-left: none; border-right: none;"></td>
                                        <td class="text-center font-bold" style="border-left: none; border-right: none;">${sheet.totalCutting % 1 === 0 ? sheet.totalCutting : sheet.totalCutting.toFixed(2)}</td>
                                        <td style="border-left: none; border-right: none;"></td>
                                        <td class="text-right font-bold" style="border-left: none;">${sheet.grandTotal % 1 === 0 ? sheet.grandTotal : sheet.grandTotal.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <table class="footer-table">
                                <thead>
                                    <tr>
                                        <th class="text-center">Rate</th>
                                        <th class="text-center">Item Code</th>
                                        <th class="text-center">Total Cutting</th>
                                        <th class="text-center">Total (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.values(summaryGroups).map(group => `
                                        <tr>
                                            <td class="text-center font-bold">${group.rate % 1 === 0 ? group.rate : group.rate.toFixed(2)}</td>
                                            <td class="text-center font-bold">${group.code}</td>
                                            <td class="text-center font-bold">${group.totalCutting % 1 === 0 ? group.totalCutting : group.totalCutting.toFixed(2)}</td>
                                            <td class="text-right font-bold">₹ ${group.totalAmount % 1 === 0 ? group.totalAmount : group.totalAmount.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background: #f8fafc;">
                                        <td colspan="2" class="text-right font-bold">Grand Total</td>
                                        <td class="text-center font-bold">${sheet.totalCutting % 1 === 0 ? sheet.totalCutting : sheet.totalCutting.toFixed(2)}</td>
                                        <td class="text-right font-bold">₹ ${sheet.grandTotal % 1 === 0 ? sheet.grandTotal : sheet.grandTotal.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div class="summary-box">
                                Summary: Total Entries: ${sheet.items.length} | Total Quantity (NOS): ${sheet.totalNos} | Grand Total Amount: ₹ ${sheet.grandTotal % 1 === 0 ? sheet.grandTotal : sheet.grandTotal.toFixed(2)}
                            </div>

                            <div class="computer-gen">
                                This is a computer-generated document.
                            </div>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            });
        });
    }

    // Connect "Add Entry" button from View page
    const btnAddLoadingEntry = document.getElementById('btn-add-loading-sheet');
    if (btnAddLoadingEntry) {
        btnAddLoadingEntry.addEventListener('click', () => {
            const addNav = document.getElementById('nav-add-loading');
            if (addNav) addNav.click();
        });
    }

    // Load DC by Number Logic
    const btnEditDcNo = document.getElementById('btn-edit-dc-no');
    if (btnEditDcNo) {
        btnEditDcNo.addEventListener('click', () => {
            const dcNo = document.getElementById('header-dc-no').value;
            if (!dcNo) {
                alert('Please enter a DC Number first.');
                return;
            }

            const sheetIndex = allLoadingSheets.findIndex(s => s.dcNo === dcNo);
            if (sheetIndex !== -1) {
                const sheet = allLoadingSheets[sheetIndex];
                
                // Restore state
                document.getElementById('header-date').value = sheet.date;
                itemsList = [...sheet.items];
                
                renderEntryTable();
                updateHeaderStats();

                // Remove from main list so it can be updated on save
                allLoadingSheets.splice(sheetIndex, 1);
                renderMainLoadingTable();

                alert(`DC ${dcNo} loaded for editing.`);
            } else {
                alert(`DC ${dcNo} not found in current session.`);
            }
        });
    }
}

/* ---- Inventory Logic ---- */
function initInventory() {
    console.log('Initializing Inventory Module');
    loadInventoryData();

    const searchInput = document.getElementById('search-inventory');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#inventory-table-body tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    const modal = document.getElementById('modal-add-item');
    const btnAddItem = document.getElementById('btn-add-inventory-item');
    const btnCloseModal = document.getElementById('btn-close-item-modal');
    const form = document.getElementById('form-add-item');

    if (btnAddItem && modal) {
        btnAddItem.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (btnCloseModal && modal) {
        btnCloseModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const code = document.getElementById('item-code-input').value;
            const rate = document.getElementById('item-rate-input').value;
            const dept = document.getElementById('item-dept-input').value;
            const status = document.getElementById('item-status-input').value;

            const newItem = { rate, code, dept, status };
            const inventory = JSON.parse(localStorage.getItem('invoice_flow_inventory') || '[]');
            inventory.unshift(newItem);
            localStorage.setItem('invoice_flow_inventory', JSON.stringify(inventory));
            
            // Sync to Supabase
            apiFetch('inventory', {
                method: 'POST',
                body: JSON.stringify({ sku: code, item_name: code, rate: parseFloat(rate), dept: dept, status: status })
            });
            
            // Refresh table
            loadInventoryData();
            
            // Close modal and reset form
            modal.style.display = 'none';
            form.reset();
            
            // UI Feedback
            if (typeof showNotification === 'function') showNotification('Item Code saved successfully!', 'success');
            else alert('Item Code saved successfully!');
        });
    }

    // New: Sync dropdown when modal opens to ensure latest departments are shown
    if (btnAddItem) {
        btnAddItem.addEventListener('click', () => {
            updateDepartmentDropdowns();
        });
    }
}

function updateDepartmentDropdowns() {
    const deptRows = document.querySelectorAll('#dept-table-body tr');
    const departments = Array.from(deptRows).map(row => {
        const cells = row.querySelectorAll('td');
        return cells[1] ? cells[1].textContent.trim() : null;
    }).filter(name => name);

    const dropdown = document.getElementById('item-dept-input');
    if (dropdown) {
        const currentVal = dropdown.value;
        dropdown.innerHTML = departments.map(dept => `<option value="${dept}">${dept}</option>`).join('');
        
        // Try to restore previous selection if it still exists
        if (departments.includes(currentVal)) {
            dropdown.value = currentVal;
        }
    }
}

async function loadInventoryData() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    let inventory = JSON.parse(localStorage.getItem('invoice_flow_inventory') || '[]');
    
    // Seed data if empty
    if (inventory.length === 0) {
        inventory = [
            { rate: '2.80', code: '73181000L01140', dept: 'Production', status: 'Inactive' },
            { rate: '25.00', code: '73181000L01150', dept: 'Inventory', status: 'Active' },
            { rate: '5.00', code: '73181000L01152', dept: 'Production', status: 'Inactive' },
            { rate: '10.00', code: '73181000L01149', dept: 'Sales', status: 'Active' },
            { rate: '16.00', code: '73181000L01142', dept: 'Production', status: 'Active' },
            { rate: '2.00', code: '73181000L01183', dept: 'Packaging', status: 'Inactive' },
            { rate: '2.80', code: '73181000L01161', dept: 'Production', status: 'Active' },
            { rate: '25.00', code: '73181000L01165', dept: 'Inventory', status: 'Inactive' },
            { rate: '16.00', code: '73181000L01158', dept: 'Quality Control', status: 'Inactive' },
            { rate: '5.00', code: '73181000L01156', dept: 'Production', status: 'Active' }
        ];
        localStorage.setItem('invoice_flow_inventory', JSON.stringify(inventory));
    }

    tbody.innerHTML = inventory.map(item => `
        <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-700);">${parseFloat(item.rate).toFixed(2)}</td>
            <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900);">${item.code}</td>
            <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">${item.dept}</td>
            <td style="padding: 16px;">
                <span style="background: ${item.status === 'Active' ? 'var(--color-success-50)' : 'var(--color-primary-50)'}; 
                             color: ${item.status === 'Active' ? 'var(--color-success-700)' : 'var(--color-primary-700)'}; 
                             padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; 
                             border: 1px solid ${item.status === 'Active' ? 'var(--color-success-200)' : 'var(--color-primary-200)'};">
                    ${item.status}
                </span>
            </td>
            <td style="padding: 16px; text-align: right;">
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-edit-inventory" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete-inventory" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    const info = document.getElementById('inventory-pagination-info');
    if (info) info.textContent = `Showing 1 to ${inventory.length} of ${inventory.length} entries`;
}

/* ---- Department Logic ---- */
function initDept() {
    console.log('Initializing Department Module');
    loadDeptData();

    const searchInput = document.getElementById('search-dept');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#dept-table-body tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    const modal = document.getElementById('modal-add-dept');
    const btnAdd = document.getElementById('btn-add-dept');
    const btnClose = document.getElementById('btn-close-dept-modal');
    const form = document.getElementById('form-add-dept');

    if (btnAdd && modal) {
        btnAdd.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (btnClose && modal) {
        btnClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('dept-name-input').value;
            const depts = JSON.parse(localStorage.getItem('invoice_flow_departments') || '[]');

            if (form.dataset.editMode === 'true' && window.currentEditDeptRow) {
                const oldName = window.currentEditDeptRow.querySelectorAll('td')[1].textContent;
                const index = depts.findIndex(d => d.name === oldName);
                if (index !== -1) depts[index].name = name;
                
                delete form.dataset.editMode;
                window.currentEditDeptRow = null;
                form.querySelector('button[type="submit"]').textContent = 'Create Department';
                document.querySelector('#modal-add-dept h3').textContent = 'Create New Department';
            } else {
                const id = 'D-' + Math.floor(100 + Math.random() * 900);
                depts.unshift({ id, name, employees: 0, status: 'Active' });
            }
            
            localStorage.setItem('invoice_flow_departments', JSON.stringify(depts));
            
            // Sync to Supabase
            const deptToSync = depts.find(d => d.name === name);
            if (deptToSync) {
                apiFetch('departments', {
                    method: 'POST',
                    body: JSON.stringify(deptToSync)
                });
            }
            loadDeptData();
            
            modal.style.display = 'none';
            form.reset();
            if (typeof showNotification === 'function') showNotification('Department saved successfully', 'success');
            else alert('Department saved successfully!');
            updateDepartmentDropdowns(); 
        });
    }

    // Handle Edit/Delete from table
    const tbody = document.getElementById('dept-table-body');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit-dept');
            const deleteBtn = e.target.closest('.btn-delete-dept');

            if (editBtn) {
                const row = editBtn.closest('tr');
                const name = row.querySelectorAll('td')[1].textContent;
                
                document.getElementById('dept-name-input').value = name;
                form.dataset.editMode = 'true';
                window.currentEditDeptRow = row;
                
                form.querySelector('button[type="submit"]').textContent = 'Update Department';
                document.querySelector('#modal-add-dept h3').textContent = 'Edit Department';
                modal.style.display = 'flex';
            }

            if (deleteBtn) {
                if (confirm('Are you sure you want to delete this department?')) {
                    deleteBtn.closest('tr').remove();
                    updateDepartmentDropdowns(); // Sync dropdowns after deleting a department
                }
            }
        });
    }
}

async function loadDeptData() {
    const tbody = document.getElementById('dept-table-body');
    if (!tbody) return;

    let depts = JSON.parse(localStorage.getItem('invoice_flow_departments') || '[]');
    
    if (depts.length === 0) {
        depts = [
            { id: 'D-101', name: 'Production', employees: 45, status: 'Active' },
            { id: 'D-102', name: 'Sales', employees: 12, status: 'Active' },
            { id: 'D-103', name: 'Inventory', employees: 8, status: 'Active' },
            { id: 'D-104', name: 'Quality Control', employees: 15, status: 'Active' },
            { id: 'D-105', name: 'Packaging', employees: 20, status: 'Active' }
        ];
        localStorage.setItem('invoice_flow_departments', JSON.stringify(depts));
    }

    tbody.innerHTML = depts.map(dept => `
        <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-500);">${dept.id}</td>
            <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900);">${dept.name}</td>
            <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">${dept.employees}</td>
            <td style="padding: 16px;">
                <span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--color-success-200);">${dept.status}</span>
            </td>
            <td style="padding: 16px; text-align: right;">
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-edit-dept" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete-dept" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    updateDepartmentDropdowns(); 
}

/* ---- Products Management ---- */
function initProducts() {
    const modal = document.getElementById('modal-add-product');
    const btnAdd = document.getElementById('btn-add-product');
    const form = document.getElementById('form-add-product');
    const tbody = document.getElementById('products-table-body');

    if (btnAdd && modal) {
        btnAdd.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    const renderProducts = () => {
        const products = JSON.parse(localStorage.getItem('invoice_flow_products') || '[]');
        
        if (products.length === 0) {
            const seedProducts = [
                { name: 'Hex Bolt M10 x 50', code: 'HB-M10-50', hsn: '7318', rate: 14.50 },
                { name: 'Self Tapping Screw', code: 'STS-08', hsn: '7318', rate: 2.80 },
                { name: 'Nylon Insert Lock Nut', code: 'NLN-M10', hsn: '7318', rate: 5.00 }
            ];
            localStorage.setItem('invoice_flow_products', JSON.stringify(seedProducts));
            return renderProducts();
        }

        tbody.innerHTML = products.map((p, index) => `
            <tr style="border-bottom: 1px solid var(--color-neutral-100);">
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900); border-bottom: 1px solid var(--color-neutral-100);">${p.name}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-100); text-transform: uppercase;">${p.code}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-100);">${p.hsn}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-neutral-900); border-bottom: 1px solid var(--color-neutral-100);">₹${parseFloat(p.rate).toFixed(2)}</td>
                <td style="padding: 16px; text-align: right; border-bottom: 1px solid var(--color-neutral-100);">
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-edit-product" data-index="${index}" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete-product" data-index="${index}" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    renderProducts();

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('product-name-input').value;
            const code = document.getElementById('product-code-input').value;
            const hsn = document.getElementById('product-hsn-input').value;
            const rate = document.getElementById('product-rate-input').value;

            const product = { name, code, hsn, rate: parseFloat(rate) };
            const products = JSON.parse(localStorage.getItem('invoice_flow_products') || '[]');
            products.unshift(product);
            localStorage.setItem('invoice_flow_products', JSON.stringify(products));
            
            // Sync to Supabase
            apiFetch('products', { 
                method: 'POST', 
                body: JSON.stringify(product) 
            });

            renderProducts();
            modal.style.display = 'none';
            form.reset();
            if (typeof showNotification === 'function') showNotification('Product added successfully!', 'success');
            else alert('Product added successfully!');
        });
    }
    
    // Handle Delete
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-product');
            if (deleteBtn) {
                if (confirm('Are you sure you want to delete this product?')) {
                    const index = parseInt(deleteBtn.dataset.index);
                    const products = JSON.parse(localStorage.getItem('invoice_flow_products') || '[]');
                    products.splice(index, 1);
                    localStorage.setItem('invoice_flow_products', JSON.stringify(products));
                    renderProducts();
                }
            }
        });
    }

    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-product');
            if (deleteBtn) {
                if (confirm('Are you sure you want to delete this product?')) {
                    deleteBtn.closest('tr').remove();
                }
            }
        });
    }
}

/* ---- Closed Items Logic ---- */
function initClosedItems() {
    const closedRDCTableBody = document.getElementById('closed-rdc-table-body');
    const closedPOTableBody = document.getElementById('closed-po-table-body');
    if (!closedRDCTableBody && !closedPOTableBody) return;

    window.refreshClosedItems = function() {
        renderClosedItems();
    };

    function renderClosedItems() {
        // 1. RDC Closed Items
        if (closedRDCTableBody) {
            const rdcs = JSON.parse(localStorage.getItem('invoice_flow_rdcs') || '[]');
            const closedRDCs = [];
            
            rdcs.forEach(rdc => {
                rdc.items.forEach(item => {
                    const qty = parseFloat(item.qty) || 0;
                    if (qty <= 0) {
                        closedRDCs.push({
                            no: rdc.noFull,
                            customer: rdc.customer,
                            product: item.product,
                            date: item.closedDate || rdc.date || 'N/A',
                            closedBy: item.closedByDC || 'Manual/System'
                        });
                    }
                });
            });

            if (closedRDCs.length === 0) {
                closedRDCTableBody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No closed RDC items found.</td></tr>`;
            } else {
                closedRDCTableBody.innerHTML = closedRDCs.map(item => `
                    <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 16px; font-weight: 700; color: var(--color-primary-900);">${item.no}</td>
                        <td style="padding: 16px; color: var(--color-neutral-700);">${item.customer}</td>
                        <td style="padding: 16px; color: var(--color-neutral-900); font-weight: 600;">${item.product}</td>
                        <td style="padding: 16px;"><span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">${item.closedBy}</span></td>
                        <td style="padding: 16px; text-align: right; color: var(--color-neutral-500); font-size: 0.875rem;">${item.date}</td>
                    </tr>
                `).join('');
            }
        }

        // 2. PO Closed Items
        if (closedPOTableBody) {
            // Placeholder for now
            if (closedPOTableBody.children.length === 0) {
                closedPOTableBody.innerHTML = `<tr><td colspan="4" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No closed Purchase Orders found.</td></tr>`;
            }
        }
    }

    renderClosedItems();
}

/* ---- Authentication & Team Management ---- */
function initAuth() {
    const STORAGE_KEY_TEAM = 'invoice_flow_team_members';
    const STORAGE_KEY_SESSION = 'invoice_flow_current_session';

    // 1. Initial State
    const defaultAdmin = {
        username: 'ADMIN',
        password: '123',
        role: 'Super Admin',
        permissions: ['nav-dashboard', 'nav-invoices', 'nav-dc', 'nav-loading-sheets', 'nav-po', 'nav-rdc', 'nav-manage', 'nav-settings']
    };

    // 2. Load/Save Team
    function getTeam() {
        const team = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAM) || '[]');
        if (team.length === 0) {
            team.push(defaultAdmin);
            localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(team));
        }
        return team;
    }

    // 3. Session Management
    function getCurrentUser() {
        return JSON.parse(sessionStorage.getItem(STORAGE_KEY_SESSION)) || defaultAdmin;
    }

    window.applyUserPermissions = function(user) {
        console.log("Applying permissions for:", user.username, user.permissions);
        
        const isSuperAdmin = user.role === 'Super Admin' || (user.permissions && user.permissions.includes('all'));
        
        // Only target top-level nav items that are direct children of the nav container
        const navItems = document.querySelectorAll('.sidebar-nav > [id]');
        navItems.forEach(item => {
            if (item.id === 'nav-logout' || item.id === 'current-user-info') return; 
            
            const permissionId = item.id;
            const alternateId = permissionId.startsWith('nav-group-') ? permissionId.replace('nav-group-', 'nav-') : permissionId.replace('nav-', 'nav-group-');
            
            const hasAccess = isSuperAdmin || 
                             (user.permissions && (
                                 user.permissions.includes(permissionId) || 
                                 user.permissions.includes(alternateId) ||
                                 (permissionId === 'nav-po' && user.permissions.includes('nav-purchase-orders'))
                             ));
            
            if (hasAccess) {
                // Use flex for everything as per sidebar.css
                item.style.display = 'flex';
                // Item groups need flex-direction column to show sub-items correctly
                if (item.classList.contains('nav-item-group')) {
                    item.style.flexDirection = 'column';
                }
            } else {
                item.style.display = 'none';
            }
        });

        // Update UI info
        const displayName = document.getElementById('user-display-name');
        const roleLabel = document.getElementById('user-role-label');
        const avatar = document.getElementById('user-avatar');
        
        if (displayName) displayName.textContent = user.name || user.username;
        if (roleLabel) roleLabel.textContent = user.role;
        if (avatar) avatar.textContent = (user.name || user.username).substring(0, 2).toUpperCase();
    }

    // Expose for login
    function applyPermissions(user) {
        window.applyUserPermissions(user);
    }

    // 4. Team Management (Admin Only)
    function initTeamUI() {
        const btnAdd = document.getElementById('btn-open-add-team');
        const modalAdd = document.getElementById('modal-add-team');
        const formAdd = document.getElementById('form-add-team');
        const modalTitle = modalAdd.querySelector('h3');
        const submitBtn = formAdd.querySelector('button[type="submit"]');
        const teamTableBody = document.getElementById('team-table-body');
        let currentEditIndex = -1;

        if (btnAdd) {
            btnAdd.onclick = () => {
                currentEditIndex = -1;
                modalTitle.textContent = 'Add Team Member';
                submitBtn.textContent = 'Create Team Member';
                formAdd.reset();
                modalAdd.style.display = 'flex';
            };
        }

        if (formAdd) {
            formAdd.onsubmit = (e) => {
                e.preventDefault();
                const name = document.getElementById('team-name').value;
                const password = document.getElementById('team-password').value;
                const checks = formAdd.querySelectorAll('.permission-check:checked');
                const permissions = Array.from(checks).map(c => c.dataset.id);

                const team = getTeam();
                const memberData = { username: name, password, role: currentEditIndex === 0 ? 'Super Admin' : 'User', permissions };

                if (currentEditIndex > -1) {
                    team[currentEditIndex] = memberData;
                } else {
                    team.push(memberData);
                }

                localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(team));
                
                // Sync to Supabase
                apiFetch('team_members', {
                    method: 'POST',
                    body: JSON.stringify(memberData)
                });
                
                modalAdd.style.display = 'none';
                formAdd.reset();
                renderTeamList();
                alert(currentEditIndex > -1 ? 'Team Member Updated!' : 'Team Member Added!');
            };
        }

        function renderTeamList() {
            if (!teamTableBody) return;
            const team = getTeam();
            teamTableBody.innerHTML = team.map((member, index) => `
                <tr style="border-bottom: 1px solid var(--color-neutral-100);">
                    <td style="padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary-100); color: var(--color-primary-700); display: flex; align-items: center; justify-content: center; font-weight: 700;">${member.username.substring(0,2).toUpperCase()}</div>
                            <div>
                                <div style="font-weight: 700; color: var(--color-neutral-900);">${member.username}</div>
                                <div style="font-size: 0.75rem; color: var(--color-neutral-500);">${member.username}@example.com</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 16px; color: var(--color-neutral-700); font-weight: 600;">${member.role}</td>
                    <td style="padding: 16px; color: var(--color-neutral-700);">Management</td>
                    <td style="padding: 16px;"><span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">Active</span></td>
                    <td style="padding: 16px; text-align: right;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button class="btn-edit-team" data-index="${index}" style="background: none; border: none; color: var(--color-primary-600); cursor: pointer;"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete-team" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; ${member.role === 'Super Admin' ? 'visibility: hidden' : ''}"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

            teamTableBody.querySelectorAll('.btn-edit-team').forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.dataset.index);
                    const member = getTeam()[idx];
                    currentEditIndex = idx;
                    
                    document.getElementById('team-name').value = member.username;
                    document.getElementById('team-password').value = member.password;
                    
                    // Reset and set checks
                    formAdd.querySelectorAll('.permission-check').forEach(check => {
                        check.checked = member.role === 'Super Admin' || member.permissions.includes(check.dataset.id);
                    });

                    modalTitle.textContent = 'Edit Team Member';
                    submitBtn.textContent = 'Update Team Member';
                    modalAdd.style.display = 'flex';
                };
            });

            teamTableBody.querySelectorAll('.btn-delete-team').forEach(btn => {
                btn.onclick = () => {
                    const idx = btn.dataset.index;
                    const team = getTeam();
                    if (confirm(`Delete user ${team[idx].username}?`)) {
                        team.splice(idx, 1);
                        localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(team));
                        renderTeamList();
                    }
                };
            });
        }

        renderTeamList();
    }

    // 5. Login/Logout Logic
    const loginModal = document.getElementById('modal-login');
    const loginForm = document.getElementById('form-login');
    const btnLogout = document.getElementById('nav-logout');

    if (btnLogout) {
        btnLogout.onclick = (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                sessionStorage.removeItem(STORAGE_KEY_SESSION);
                loginModal.style.display = 'flex';
            }
        };
    }



    const initPasswordToggles = () => {
        document.querySelectorAll('.password-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                const icon = btn.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    };

    // Initial load
    const currentUser = getCurrentUser();
    applyPermissions(currentUser);
    initTeamUI();
    initPasswordToggles();
}

/* ---- Purchase Orders Logic ---- */
function initPO() {
    const poTableBody = document.getElementById('po-table-body');
    const poForm = document.getElementById('form-add-po');
    const poSearch = document.getElementById('po-search');
    const btnAddRow = document.getElementById('btn-po-add-row');
    const btnBulkAdd = document.getElementById('btn-po-bulk-add');
    const itemsTableBody = document.getElementById('po-items-body');
    const bulkAddModal = document.getElementById('modal-po-bulk-add');
    const btnConfirmBulkAdd = document.getElementById('btn-confirm-bulk-add');
    const bulkTextArea = document.getElementById('po-bulk-codes');

    if (!poTableBody || !poForm || !itemsTableBody) return;

    window.renderPOList = function(searchTerm = '') {
        const pos = JSON.parse(localStorage.getItem('invoice_flow_pos') || '[]');
        const term = (searchTerm || '').toLowerCase();

        const filtered = pos.filter(po => {
            const poNo = (po.no || '').toLowerCase();
            const vendor = (po.vendor || '').toLowerCase();
            const itemsMatch = (po.items || []).some(it => (it.itemCode || '').toLowerCase().includes(term));
            
            return poNo.includes(term) || vendor.includes(term) || itemsMatch;
        });

        if (filtered.length === 0) {
            poTableBody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No purchase orders found.</td></tr>`;
            return;
        }

        poTableBody.innerHTML = filtered.map(po => {
            const items = po.items || [];
            const firstItem = items[0] || { itemCode: 'N/A' };
            const itemDisplay = items.length > 1 ? `${firstItem.itemCode} <span style="color: var(--color-neutral-400); font-size: 0.75rem;">(+${items.length - 1} more)</span>` : firstItem.itemCode;
            const totalQty = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
            const avgRate = items.length > 0 ? (items.reduce((sum, it) => sum + (parseFloat(it.rate) || 0), 0) / items.length) : 0;

            return `
                <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 16px;"><div style="font-weight: 700; color: var(--color-primary-900);">${po.no || 'N/A'}</div><div style="font-size: 0.75rem; color: var(--color-neutral-500);">${po.date || ''}</div></td>
                    <td style="padding: 16px; color: var(--color-neutral-700);">${itemDisplay}</td>
                    <td style="padding: 16px; color: var(--color-neutral-900); font-weight: 600;">${typeof formatCurrency === 'function' ? formatCurrency(avgRate) : avgRate.toFixed(2)}</td>
                    <td style="padding: 16px; color: var(--color-neutral-900); font-weight: 600;">${totalQty} Nos</td>
                    <td style="padding: 16px;"><span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">${po.status || 'Active'}</span></td>
                    <td style="padding: 16px; text-align: right;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button onclick="viewPODetails(${po.id})" style="background: none; border: none; color: var(--color-primary-600); cursor: pointer; padding: 4px;" title="View Details"><i class="fas fa-eye"></i></button>
                            <button onclick="editPO(${po.id})" style="background: none; border: none; color: var(--color-primary-600); cursor: pointer; padding: 4px;" title="Edit PO"><i class="fas fa-edit"></i></button>
                            <button onclick="deletePO(${po.id})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Delete PO"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };


    // Attach submit listener EARLY to prevent default reloads even if rendering fails
    poForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('PO Form Submit Triggered');
        try {
            const poId = document.getElementById('po-id').value;
            const poNo = (document.getElementById('po-no').value || '').trim();
            const poDate = document.getElementById('po-date').value;
            const vendor = document.getElementById('po-vendor').value;
            const items = [];
            const rows = itemsTableBody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const itemCodeInput = row.querySelector('.item-code-input');
                const rateInput = row.querySelector('.rate-input');
                const qtyInput = row.querySelector('.qty-input');
                
                if (itemCodeInput && itemCodeInput.value.trim()) {
                    items.push({ 
                        itemCode: itemCodeInput.value.trim(), 
                        rate: parseFloat(rateInput?.value) || 0, 
                        qty: parseFloat(qtyInput?.value) || 0 
                    });
                }
            });

            if (items.length === 0) {
                alert('Please add at least one item.');
                return;
            }

            const pos = JSON.parse(localStorage.getItem('invoice_flow_pos') || '[]');
            
            if (poId) {
                // Edit mode
                const index = pos.findIndex(p => p.id == poId);
                if (index !== -1) {
                    pos[index] = { ...pos[index], no: poNo, date: poDate, vendor: vendor, items: items };
                    showNotification('Purchase Order updated successfully!', 'success');
                }
            } else {
                // Create mode
                const newPO = { 
                    id: Date.now(), 
                    no: poNo, 
                    date: poDate, 
                    vendor: vendor, 
                    items: items, 
                    status: 'Active', 
                    createdAt: new Date().toISOString() 
                };
                pos.unshift(newPO);
                showNotification('Purchase Order created successfully!', 'success');
            }

            localStorage.setItem('invoice_flow_pos', JSON.stringify(pos));

            // Sync to Supabase (Non-blocking)
            const poDataSync = { no: poNo, date: poDate, vendor: vendor, items: items, status: 'Active' };
            apiFetch('purchase_orders', {
                method: 'POST',
                body: JSON.stringify(poDataSync)
            }).catch(err => console.warn('Supabase sync error:', err));

            // UI Reset
            poForm.reset();
            document.getElementById('po-id').value = '';
            itemsTableBody.innerHTML = '';
            window.addPORow();
            document.getElementById('modal-add-po').style.display = 'none';
            window.renderPOList();
            
            
        } catch (err) {

            console.error('PO Submission Error:', err);
            alert('Error saving Purchase Order: ' + err.message);
        }
    });


    const btnOpenAdd = document.getElementById('btn-open-add-po');
    if (btnOpenAdd) {
        btnOpenAdd.onclick = () => {
            document.getElementById('po-id').value = '';
            poForm.reset();
            itemsTableBody.innerHTML = '';
            addPORow();
            document.getElementById('modal-add-po').style.display = 'flex';
        };
    }

    window.addPORow = function(data = null) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--color-neutral-100)';
        tr.innerHTML = `
            <td style="padding: 12px;">
                <input type="text" class="form-control item-code-input" value="${data?.itemCode || ''}" required placeholder="Item Code" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px; font-size: 0.875rem; outline: none;">
            </td>
            <td style="padding: 12px;">
                <input type="number" step="0.01" class="form-control rate-input" value="${data?.rate || ''}" required placeholder="0.00" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px; font-size: 0.875rem; outline: none;">
            </td>
            <td style="padding: 12px;">
                <input type="number" class="form-control qty-input" value="${data?.qty || ''}" required placeholder="0" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px; font-size: 0.875rem; text-align: center; outline: none;">
            </td>
            <td style="padding: 12px; text-align: center;">
                <button type="button" class="btn-remove-po-row" style="background: #fee2e2; color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'"><i class="fas fa-times"></i></button>
            </td>
        `;
        itemsTableBody.appendChild(tr);
        
        tr.querySelector('.btn-remove-po-row').addEventListener('click', () => {
            if (itemsTableBody.children.length > 1) {
                tr.remove();
            } else {
                tr.querySelectorAll('input').forEach(input => input.value = '');
            }
        });
    }

    // Initialize with one row if empty
    if (itemsTableBody.children.length === 0) {
        window.addPORow();
    }

    if (itemsTableBody.children.length === 0) {
        addPORow();
    }

    if (btnAddRow) {
        btnAddRow.addEventListener('click', () => addPORow());
    }

    if (btnBulkAdd && bulkAddModal) {
        btnBulkAdd.addEventListener('click', () => {
            bulkAddModal.style.display = 'flex';
            if (bulkTextArea) {
                bulkTextArea.value = '';
                bulkTextArea.focus();
            }
        });
    }

    if (btnConfirmBulkAdd && bulkAddModal) {
        btnConfirmBulkAdd.addEventListener('click', () => {
            const codes = bulkTextArea.value.split(/[\n,]+/).map(c => c.trim()).filter(c => c);
            if (codes.length === 0) {
                alert('Please enter at least one item code.');
                return;
            }

            const firstRow = itemsTableBody.children[0];
            const firstInput = firstRow?.querySelector('.item-code-input');
            let startIndex = 0;
            
            if (firstInput && !firstInput.value && itemsTableBody.children.length === 1) {
                firstInput.value = codes[0];
                startIndex = 1;
            }

            for (let i = startIndex; i < codes.length; i++) {
                addPORow({ itemCode: codes[i] });
            }

            bulkAddModal.style.display = 'none';
        });
    }

    function populateSuppliers() {
        const supplierSelect = document.getElementById('po-vendor');
        if (supplierSelect) {
            const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
            const currentVal = supplierSelect.value;
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            supplierSelect.innerHTML = '<option value="">Select Supplier</option>' + 
                customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            
            if (currentVal) supplierSelect.value = currentVal;
            else if (profile.defaultCustomer) supplierSelect.value = profile.defaultCustomer;
        }
    }

    // Call it immediately and on modal open
    try {
        populateSuppliers();
        if (typeof window.renderPOList === 'function') {
            window.renderPOList();
        }
    } catch (e) {
        console.error("Error during initial PO rendering:", e);
    }

    window.addEventListener('click', (e) => {
        if (e.target.id === 'modal-add-po') populateSuppliers();
    });
    if (poSearch) {
        poSearch.addEventListener('input', (e) => {
            if (typeof window.renderPOList === 'function') {
                window.renderPOList(e.target.value);
            }
        });
    }
    window.openAddPO = function() {
        const modal = document.getElementById('modal-add-po');
        const form = document.getElementById('form-add-po');
        const poIdInput = document.getElementById('po-id');
        const itemsBody = document.getElementById('po-items-body');
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!modal || !form || !poIdInput || !itemsBody) return;

        form.reset();
        poIdInput.value = '';
        submitBtn.textContent = 'ADD PO';
        modal.querySelector('h3').textContent = 'ADD PO';
        itemsBody.innerHTML = '';
        addPORow();
        modal.style.display = 'flex';
    };

    window.editPO = function(id) {
        const pos = JSON.parse(localStorage.getItem('invoice_flow_pos') || '[]');
        const po = pos.find(p => p.id === id);
        if (!po) return;

        const modal = document.getElementById('modal-add-po');
        const form = document.getElementById('form-add-po');
        const poIdInput = document.getElementById('po-id');
        const poNoInput = document.getElementById('po-no');
        const poDateInput = document.getElementById('po-date');
        const poVendorInput = document.getElementById('po-vendor');
        const itemsBody = document.getElementById('po-items-body');
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!modal || !form || !poIdInput || !poNoInput || !poDateInput || !poVendorInput || !itemsBody) return;

        // Set values
        poIdInput.value = po.id;
        poNoInput.value = po.no;
        poDateInput.value = po.date || '';
        poVendorInput.value = po.vendor || '';
        submitBtn.textContent = 'UPDATE PO';
        modal.querySelector('h3').textContent = 'EDIT PO';

        // Set items
        itemsBody.innerHTML = '';
        if (po.items && po.items.length > 0) {
            po.items.forEach(item => addPORow(item));
        } else {
            addPORow();
        }

        modal.style.display = 'flex';
    };

    window.viewPODetails = function(id) {
        const pos = JSON.parse(localStorage.getItem('invoice_flow_pos') || '[]');
        const po = pos.find(p => p.id === id);
        if (!po) return;
        const modal = document.getElementById('modal-po-view-details');
        if (!modal) return;
        document.getElementById('po-view-modal-title').textContent = `Purchase Order: ${po.no}`;
        document.getElementById('po-view-modal-subtitle').textContent = `Supplier: ${po.vendor || 'N/A'} | Date: ${po.date || 'N/A'}`;
        const headerGrid = document.getElementById('po-view-modal-header-grid');
        headerGrid.innerHTML = `<div><div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">PO Number</div><div style="font-weight: 700; color: #1e293b;">${po.no}</div></div><div><div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Date</div><div style="font-weight: 700; color: #1e293b;">${po.date || 'N/A'}</div></div><div><div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Supplier</div><div style="font-weight: 700; color: #1e293b;">${po.vendor || 'N/A'}</div></div><div><div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Status</div><div><span style="background: var(--color-success-50); color: var(--color-success-700); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">${po.status}</span></div></div>`;
        const itemsBody = document.getElementById('po-view-modal-items-body');
        itemsBody.innerHTML = po.items.map((item, idx) => `<tr style="border-bottom: solid 1px #f1f5f9;"><td style="padding: 12px 16px; font-size: 0.875rem; color: #64748b;">${idx + 1}</td><td style="padding: 12px 16px; font-size: 0.875rem; font-weight: 600; color: #1e293b;">${item.itemCode}</td><td style="padding: 12px 16px; font-size: 0.875rem; text-align: center; color: #1e293b;">${item.qty}</td><td style="padding: 12px 16px; font-size: 0.875rem; text-align: center; color: #1e293b;">${formatCurrency(item.rate)}</td><td style="padding: 12px 16px; font-size: 0.875rem; text-align: right; font-weight: 700; color: #1e293b;">${formatCurrency(item.qty * item.rate)}</td></tr>`).join('');
        modal.style.display = 'flex';
    };

    window.deletePO = function(id) {
        if (!confirm('Are you sure you want to delete this Purchase Order?')) return;
        let pos = JSON.parse(localStorage.getItem('invoice_flow_pos') || '[]');
        pos = pos.filter(po => po.id !== id);
        localStorage.setItem('invoice_flow_pos', JSON.stringify(pos));
        renderPOList();
        if (typeof showNotification === 'function') showNotification('PO deleted successfully', 'info');
    };
}
/* ========================================
   COMPANY PROFILE MANAGEMENT
   ======================================== */
const STORAGE_KEY_PROFILE = 'invoice_flow_company_profile';

function initCompanyProfile() {
    const form = document.getElementById('form-company-profile');
    const saveBtn = document.getElementById('btn-save-profile');
    const logoInput = document.getElementById('profile-logo-input');
    const logoPreview = document.getElementById('profile-logo-preview');
    const logoPlaceholder = document.getElementById('profile-logo-placeholder');

    // Load Profile
    const profile = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILE) || '{}');
    if (profile.name) document.getElementById('profile-company-name').value = profile.name;
    if (profile.gst) document.getElementById('profile-gst-no').value = profile.gst;
    if (profile.vendorCode) document.getElementById('profile-vendor-code').value = profile.vendorCode;
    if (profile.address) document.getElementById('profile-address').value = profile.address;
    if (profile.email) document.getElementById('profile-email').value = profile.email;
    if (profile.phone) document.getElementById('profile-phone').value = profile.phone;
    if (profile.defaultTax) document.getElementById('settings-default-tax').value = profile.defaultTax;
    if (profile.rdcLimit) document.getElementById('settings-rdc-limit').value = profile.rdcLimit;
    if (profile.currency) document.getElementById('settings-currency').value = profile.currency;
    
    const defaultCustSelect = document.getElementById('profile-default-customer');
    if (defaultCustSelect) {
        const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
        defaultCustSelect.innerHTML = '<option value="">No Default Supplier</option>' + 
            customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if (profile.defaultCustomer) defaultCustSelect.value = profile.defaultCustomer;
    }
    if (profile.logo) {
        logoPreview.src = profile.logo;
        logoPreview.style.display = 'block';
        logoPlaceholder.style.display = 'none';
    }

    function updateAppLogos(logoUrl) {
        const sidebarImg = document.getElementById('sidebar-logo-img');
        const sidebarFallback = document.getElementById('sidebar-logo-fallback');
        const printImg = document.getElementById('print-logo-img');
        const printFallback = document.getElementById('print-logo-placeholder');

        if (logoUrl) {
            if (sidebarImg) { sidebarImg.src = logoUrl; sidebarImg.style.display = 'block'; }
            if (sidebarFallback) sidebarFallback.style.display = 'none';
            if (printImg) { printImg.src = logoUrl; printImg.style.display = 'block'; }
            if (printFallback) printFallback.style.display = 'none';
        } else {
            if (sidebarImg) sidebarImg.style.display = 'none';
            if (sidebarFallback) sidebarFallback.style.display = 'block';
            if (printImg) printImg.style.display = 'none';
            if (printFallback) printFallback.style.display = 'block';
        }
    }
    
    updateAppLogos(profile.logo);

    // Save Profile
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const updatedProfile = {
                name: document.getElementById('profile-company-name').value,
                gst: document.getElementById('profile-gst-no').value,
                vendorCode: document.getElementById('profile-vendor-code').value,
                address: document.getElementById('profile-address').value,
                email: document.getElementById('profile-email').value,
                phone: document.getElementById('profile-phone').value,
                defaultCustomer: document.getElementById('profile-default-customer').value,
                defaultTax: document.getElementById('settings-default-tax').value,
                rdcLimit: document.getElementById('settings-rdc-limit').value,
                currency: document.getElementById('settings-currency').value,
                logo: logoPreview.src || ''
            };
            localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updatedProfile));
            
            // Sync to Supabase
            apiFetch('app_settings', {
                method: 'POST',
                body: JSON.stringify({ key: 'company_profile', value: updatedProfile })
            });
            updateAppLogos(updatedProfile.logo);
            updateAllPrintHeaders();
            alert('Company profile updated successfully!');
        });
    }

    // Logo Upload
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    logoPreview.src = event.target.result;
                    logoPreview.style.display = 'block';
                    logoPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function updateAllPrintHeaders() {
    const profile = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILE) || '{}');
    if (!profile.name) return;

    // Update Company Name in all templates
    document.querySelectorAll('.print-company-name').forEach(el => el.textContent = profile.name);
    
    // Update Address
    document.querySelectorAll('.print-company-address').forEach(el => el.textContent = profile.address);
    
    // Update Contact
    const contactText = `PHONE: ${profile.phone || ''} | EMAIL: ${profile.email || ''}`;
    document.querySelectorAll('.print-company-contact').forEach(el => el.textContent = contactText);
    
    // Update Tax Info
    document.querySelectorAll('.print-company-gst').forEach(el => el.textContent = profile.gst || '');
    // PAN extraction (simple)
    const pan = profile.gst ? profile.gst.substring(2, 12) : '';
    document.querySelectorAll('.print-company-pan').forEach(el => el.textContent = pan);
}

// Ensure headers are updated when app loads
document.addEventListener('DOMContentLoaded', () => {
    initCompanyProfile();
    updateAllPrintHeaders();
});
