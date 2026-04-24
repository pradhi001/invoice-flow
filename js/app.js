/* ========================================
   Invoice Flow - App JavaScript
   ======================================== */

// --- 1. API CONFIG ---
// Change this to your Vercel backend URL after deployment
// For local dev: 'http://localhost:3000'
// For production: 'https://your-backend.vercel.app'
const API_BASE = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initAnimations();
    initInvoiceTabs();

    // Load live data from backend
    loadDashboardData();
    loadInvoicesData();
});

// --- 2. API HELPER ---
async function apiFetch(endpoint, options = {}) {
    try {
        const url = `${API_BASE}/api/${endpoint}`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'API Error');
        return data;
    } catch (err) {
        console.warn(`API (${endpoint}):`, err.message, '— using static data');
        return null;
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
    const data = await apiFetch(params);
    if (!data) return;

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
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD'
    }).format(Number(value) || 0);
}


/* ---- Navigation ---- */
function initNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item:not(.nav-dropdown-toggle)');
    const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
    const searchInput = document.getElementById('search-input');

    const searchPlaceholders = {
        'dashboard': 'Search transactions...',
        'invoices': 'Search invoices or companies...',
        'delivery-challans': 'Search challans...',
        'loading-sheets': 'Search loading sheets...',
        'purchase-orders': 'Search purchase orders...',
        'return-delivery': 'Search return challans...',
        'inventory': 'Search inventory...',
        'settings': 'Search settings...'
    };

    // Handle dropdown toggles
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const group = toggle.closest('.nav-item-group');
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

            // Update search placeholder
            if (searchInput && searchPlaceholders[pageName]) {
                searchInput.placeholder = searchPlaceholders[pageName];
            }
        });
    });
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
