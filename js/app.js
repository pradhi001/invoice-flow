/* ========================================
   Invoice Flow - App JavaScript
   ======================================== */

// --- 1. API CONFIG ---
// Change this to your Vercel backend URL after deployment
// For local dev: 'http://localhost:3000'
// For production: 'https://your-backend.vercel.app'
const API_BASE = 'http://localhost:3000';

// --- DC Numbering Helper ---
function getNextDCNo() {
    const sequence = parseInt(localStorage.getItem('invoice_flow_dc_sequence') || '1');
    const fy = "26/27"; 
    const paddedSeq = sequence.toString().padStart(3, '0');
    return `${paddedSeq} - ${fy}`;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing App');
    const initFunctions = [
        { name: 'Vendors', fn: typeof initVendorForm !== 'undefined' ? initVendorForm : null },
        { name: 'DC', fn: typeof initDCForm !== 'undefined' ? initDCForm : null },
        { name: 'Navigation', fn: typeof initNavigation !== 'undefined' ? initNavigation : null },
        { name: 'Search', fn: typeof initSearch !== 'undefined' ? initSearch : null },
        { name: 'Animations', fn: typeof initAnimations !== 'undefined' ? initAnimations : null },
        { name: 'InvoiceTabs', fn: typeof initInvoiceTabs !== 'undefined' ? initInvoiceTabs : null },
        { name: 'LoadingSheets', fn: typeof initLoadingSheets !== 'undefined' ? initLoadingSheets : null },
        { name: 'Inventory', fn: typeof initInventory !== 'undefined' ? initInventory : null },
        { name: 'Dept', fn: typeof initDept !== 'undefined' ? initDept : null },
        { name: 'Products', fn: typeof initProducts !== 'undefined' ? initProducts : null },
        { name: 'Customers', fn: typeof initCustomers !== 'undefined' ? initCustomers : null },
        { name: 'RDC', fn: typeof initRDC !== 'undefined' ? initRDC : null },
        { name: 'ClosedItems', fn: typeof initClosedItems !== 'undefined' ? initClosedItems : null }
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
        'vendors': 'Search vendors by name, GST...',
        'add-vendor': 'Enter vendor details...',
        'add-dc': 'Enter challan details...',
        'view-dc': 'Search delivery challans...',
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

            if (searchInput && searchPlaceholders[pageName]) {
                searchInput.placeholder = searchPlaceholders[pageName];
            }

            // Refresh Closed Items if navigating there
            if ((pageName === 'closed-rdc' || pageName === 'closed-po') && typeof window.refreshClosedItems === 'function') {
                window.refreshClosedItems();
            }

            // Reset DC No if creating new
            if (pageName === 'add-dc') {
                const dcNoInput = document.getElementById('dc-number-input');
                const form = document.getElementById('form-add-dc');
                if (dcNoInput && (!form.dataset.editMode || form.dataset.editMode !== 'true')) {
                    dcNoInput.value = getNextDCNo();
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
            
            // Update sidebar nav state
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            const createNav = document.getElementById('nav-create-invoice');
            if (createNav) {
                createNav.classList.add('active');
                const group = createNav.closest('.nav-item-group');
                if (group) group.classList.add('open');
            }
        });
    }

    // Handle "Add Vendor" button click from Vendors page
    const btnAddVendorPage = document.getElementById('btn-add-vendor-page');
    if (btnAddVendorPage) {
        btnAddVendorPage.addEventListener('click', () => {
            const addVendorNav = document.getElementById('nav-add-vendor');
            if (addVendorNav) addVendorNav.click();
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

    function formatCurrency(num) {
        return '$' + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
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

    function attachRowEvents(row) {
        const qtyInput = row.querySelector('.qty-input');
        const priceInput = row.querySelector('.price-input');
        const btnRemove = row.querySelector('.btn-remove-row');

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

    // Attach events to initial row
    tbody.querySelectorAll('tr').forEach(attachRowEvents);

    // Add new row
    btnAddRow.addEventListener('click', (e) => {
        e.preventDefault();
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--color-neutral-100)';
        tr.style.transition = 'background 0.2s';
        tr.innerHTML = `
            <td style="padding: 16px;">
                <input type="text" value="DC-0000" class="form-control dc-input" style="width: 100%; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px;">
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
                $ <input type="number" class="form-control price-input" value="0.00" style="width: 80px; padding: 8px; background: transparent; border: 1px solid transparent; font-family: inherit; font-size: 0.875rem; outline: none; border-radius: 4px; color: var(--color-neutral-600);">
            </td>
            <td style="padding: 16px; font-weight: 700; color: var(--color-primary-900);">
                <span class="amount-val">$0.00</span>
            </td>
            <td style="padding: 16px; text-align: right;">
                <button class="btn-remove-row" style="background: transparent; color: var(--color-neutral-400); border: none; cursor: pointer; font-size: 1rem; padding: 4px 8px; border-radius: 4px; transition: 0.2s;" onmouseover="this.style.color='var(--color-error-600)'" onmouseout="this.style.color='var(--color-neutral-400)'"><i class="fas fa-times"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
        attachRowEvents(tr);
        calculateTotal();
    });

    // Initialize with two rows like the screenshot
    btnAddRow.click();
    btnAddRow.click();

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
                    <td style="border: 1px solid black; padding: 6px;">${qty}</td>
                    <td style="border: 1px solid black; padding: 6px;">${parseFloat(price||0).toFixed(2)}</td>
                    <td style="border: 1px solid black; padding: 6px; text-align: right;">${formatCurrency(amount).replace('$', '')}</td>
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
                printCgst.textContent = formatCurrency(halfTax).replace('$', '');
                printSgst.textContent = formatCurrency(halfTax).replace('$', '');
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
function initVendorForm() {
    const form = document.getElementById('form-add-vendor');
    if (!form) {
        console.error('Vendor Form not found in DOM!');
        return;
    }

    console.log('Vendor Form initialized and listener attached.');

    // Image Upload Handling
    const imgContainer = document.getElementById('vendor-image-container');
    const imgInput = document.getElementById('vendor-image-input');
    const imgPreview = document.getElementById('vendor-image-preview');
    const imgPlaceholder = document.getElementById('vendor-image-placeholder');

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
                    imgContainer.style.borderColor = 'var(--color-primary-400)';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Vendor Form submit event intercepted!');
        
        // 1. Grab values from the form
        const name = document.getElementById('vendor-name').value;
        const type = document.getElementById('vendor-type').value;
        const phone = document.getElementById('vendor-phone').value;
        const email = document.getElementById('vendor-email').value;
        const address = document.getElementById('vendor-address').value;
        const state = document.getElementById('vendor-state').value;
        const code = document.getElementById('vendor-code').value;
        const pan = document.getElementById('vendor-pan').value;
        const gst = document.getElementById('vendor-gst').value;
        const imgUrl = imgPreview.style.display !== 'none' ? imgPreview.src : null;

        const imageHtml = imgUrl 
            ? `<img src="${imgUrl}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">`
            : `<div style="width: 40px; height: 40px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #64748b;">
                <i class="fas fa-building"></i>
               </div>`;

        const rowContent = `
            <td style="padding: 16px;">
                ${imageHtml}
            </td>
            <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-700); font-weight: 600;">${type}</td>
            <td style="padding: 16px;">
                <div style="font-weight: 700; color: var(--color-primary-900); font-size: 0.875rem;">${name}</div>
                <div style="font-size: 0.75rem; color: var(--color-neutral-500); margin-top: 4px;">Code: ${code}</div>
            </td>
            <td style="padding: 16px;">
                <div style="font-size: 0.875rem; color: var(--color-neutral-700);"><i class="fas fa-phone" style="font-size: 0.75rem; color: var(--color-neutral-400); margin-right: 6px;"></i> ${phone}</div>
                <div style="font-size: 0.75rem; color: var(--color-neutral-500); margin-top: 4px;"><i class="fas fa-envelope" style="font-size: 0.75rem; color: var(--color-neutral-400); margin-right: 6px;"></i> ${email}</div>
            </td>
            <td style="padding: 16px;">
                <div style="font-size: 0.875rem; color: var(--color-neutral-700);">${address}</div>
                <div style="font-size: 0.75rem; color: var(--color-neutral-500); margin-top: 4px;">${state}</div>
            </td>
            <td style="padding: 16px;">
                <div style="font-size: 0.875rem; color: var(--color-neutral-700);"><span style="color: var(--color-neutral-500); font-size: 0.75rem;">PAN:</span> ${pan}</div>
                <div style="font-size: 0.875rem; color: var(--color-neutral-700); margin-top: 4px;"><span style="color: var(--color-neutral-500); font-size: 0.75rem;">GST:</span> ${gst}</div>
            </td>
            <td style="padding: 16px;">
                <span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--color-success-200);">Active</span>
            </td>
            <td style="padding: 16px; text-align: right;">
                <button class="btn-edit-vendor" style="background: transparent; color: var(--color-primary-600); border: none; cursor: pointer; padding: 4px; border-radius: 4px; transition: 0.2s;" onmouseover="this.style.background='var(--color-primary-50)'" onmouseout="this.style.background='transparent'"><i class="fas fa-pen"></i></button>
            </td>
        `;

        // 2. Create or Update row
        const tbody = document.getElementById('vendor-table-body');
        if (tbody) {
            if (form.dataset.editRowIndex !== undefined) {
                // Update existing row
                const rowIndex = parseInt(form.dataset.editRowIndex);
                tbody.children[rowIndex].innerHTML = rowContent;
            } else {
                // Create new row
                const newRow = document.createElement('tr');
                newRow.style.borderBottom = '1px solid var(--color-neutral-100)';
                newRow.style.transition = 'background 0.2s';
                newRow.onmouseover = () => newRow.style.background = '#f8fafc';
                newRow.onmouseout = () => newRow.style.background = 'transparent';
                newRow.innerHTML = rowContent;
                tbody.prepend(newRow);
            }
        }

        // 3. UI Feedback and Navigation
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        btn.style.background = 'var(--color-success-600)';
        btn.disabled = true;

        setTimeout(() => {
            form.reset();
            delete form.dataset.editRowIndex; // Clear edit state
            const header = document.querySelector('#page-add-vendor h2');
            if (header) header.textContent = 'Add New Vendor';

            imgPreview.style.display = 'none';
            imgPlaceholder.style.display = 'flex';
            imgContainer.dataset.hasImage = '';
            imgContainer.style.borderColor = 'var(--color-neutral-200)';
            
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.disabled = false;

            const viewVendorsNav = document.getElementById('nav-view-vendors');
            if (viewVendorsNav) viewVendorsNav.click();
        }, 800);
    });

    // Handle Edit Button Click
    const tbody = document.getElementById('vendor-table-body');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-edit-vendor');
            if (!btn) return;

            const row = btn.closest('tr');
            const cells = row.querySelectorAll('td');
            
            // Extract data from cells
            // Column mapping: 0:Image, 1:Type, 2:Name/Code, 3:Phone/Email, 4:Address/State, 5:PAN/GST
            const type = cells[1].textContent.trim();
            const name = cells[2].querySelector('div:first-child').textContent.trim();
            const code = cells[2].querySelector('div:last-child').textContent.replace('Code: ', '').trim();
            const phone = cells[3].querySelector('div:first-child').textContent.trim();
            const email = cells[3].querySelector('div:last-child').textContent.trim();
            const address = cells[4].querySelector('div:first-child').textContent.trim();
            const state = cells[4].querySelector('div:last-child').textContent.trim();
            const pan = cells[5].querySelector('div:first-child').textContent.replace('PAN: ', '').trim();
            const gst = cells[5].querySelector('div:last-child').textContent.replace('GST: ', '').trim();
            
            // Fill form
            document.getElementById('vendor-name').value = name;
            document.getElementById('vendor-type').value = type;
            document.getElementById('vendor-phone').value = phone;
            document.getElementById('vendor-email').value = email;
            document.getElementById('vendor-address').value = address;
            document.getElementById('vendor-state').value = state;
            document.getElementById('vendor-code').value = code;
            document.getElementById('vendor-pan').value = pan;
            document.getElementById('vendor-gst').value = gst;

            // Handle image preview if exists
            const img = cells[0].querySelector('img');
            if (img) {
                imgPreview.src = img.src;
                imgPreview.style.display = 'block';
                imgPlaceholder.style.display = 'none';
                imgContainer.dataset.hasImage = 'true';
            } else {
                imgPreview.style.display = 'none';
                imgPlaceholder.style.display = 'flex';
                imgContainer.dataset.hasImage = '';
            }

            // Change header and go to page
            const header = document.querySelector('#page-add-vendor h2');
            if (header) header.textContent = 'Edit Vendor';
            
            const addNav = document.getElementById('nav-add-vendor');
            if (addNav) addNav.click();
            
            // Store that we are editing this row
            form.dataset.editRowIndex = Array.from(tbody.children).indexOf(row);
        });
    }
}

/* ---- Delivery Challan (DC) Logic ---- */
function initDCForm() {
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
        const selectAll = document.getElementById('rdc-select-all');
        if (!modal || !selectorBody || !btnBulkAdd) return;

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
                selectorBody.innerHTML = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: var(--color-neutral-400);">No available RDC items found.</td></tr>`;
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

    // Handle form submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 1. Extract Header Data
        const dcDate = document.getElementById('dc-date').value;
        const orderNo = document.getElementById('dc-order-no').value;
        const orderDate = document.getElementById('dc-order-date').value;
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

            const dcData = { dcDate, orderNo, orderDate, vendorName, dcNo: finalDcNo, items, totalQty };
            targetRow.dataset.dcData = JSON.stringify(dcData);
            
            targetRow.innerHTML = `
                <td style="padding: 16px; font-size: 0.875rem;">${dcDate}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-primary-900);">${finalDcNo}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${vendorName}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${orderNo}</td>
                <td style="padding: 16px; font-size: 0.875rem;">${items.length} Items</td>
                <td style="padding: 16px; display: flex; justify-content: flex-end; gap: 12px;">
                    <button class="btn-edit-row" style="background: transparent; color: var(--color-neutral-600); border: none; cursor: pointer; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--color-primary-600)'" onmouseout="this.style.color='var(--color-neutral-600)'" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-print-row" style="background: transparent; color: var(--color-primary-600); border: none; cursor: pointer; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='var(--color-primary-800)'" onmouseout="this.style.color='var(--color-primary-600)'" title="Print"><i class="fas fa-print"></i></button>
                </td>
            `;
            
            if (form.dataset.editMode !== 'true') {
                viewTableBody.prepend(targetRow);
            }
        }

        // 4. Populate Print Template (Both Copies)
        const updateText = (className, text) => {
            document.querySelectorAll('.' + className).forEach(el => el.textContent = text);
        };

        updateText('print-dc-no', dcNo);
        updateText('print-dc-date', dcDate);
        updateText('print-dc-order-no', orderNo);
        updateText('print-dc-order-date', orderDate);
        updateText('print-dc-vendor-name', vendorName);
        updateText('print-dc-total-qty', totalQty);
        
        // Update both table bodies
        document.querySelectorAll('.print-dc-table-body').forEach(printTableBody => {
            printTableBody.innerHTML = '';
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                tr.innerHTML = `
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.sno}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: left;">${item.desc}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.code}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.hsn}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.totalQty}</td>
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
            document.getElementById('dc-order-no').value = data.orderNo;
            document.getElementById('dc-order-date').value = data.orderDate;
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
            updateText('print-dc-order-no', data.orderNo);
            updateText('print-dc-order-date', data.orderDate);
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

    let itemsList = [];
    let allLoadingSheets = []; // Store full sheets data

    // Auto-calculate item total: NOS * CUTTING * RATE
    function calculateItemTotal() {
        const nos = parseFloat(itemNos.value) || 0;
        const cutting = parseFloat(itemCutting.value) || 0;
        const rate = parseFloat(itemRate.value) || 0;
        const total = nos * cutting * rate; 
        itemTotal.value = total.toFixed(2);
    }

    [itemNos, itemRate, itemCutting].forEach(el => {
        if (el) el.addEventListener('input', calculateItemTotal);
    });

    // Add Item to Table
    btnAddItem.addEventListener('click', () => {
        const customer = document.getElementById('item-customer').value;
        const no = document.getElementById('item-no').value;
        const name = document.getElementById('item-name').value;
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

        const item = { customer, no, name, serial, nos, cutting, rate, total };
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
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700); text-align: center;">${item.cutting}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; color: var(--color-neutral-700); text-align: center;">${item.rate.toFixed(2)}</td>
                <td style="padding: 12px 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900); text-align: center;">${item.total.toFixed(2)}</td>
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
        ['item-customer', 'item-no', 'item-name', 'item-serial', 'item-nos', 'item-rate', 'item-total'].forEach(id => {
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
        if (headerTotalCutting) headerTotalCutting.value = totalCutting.toFixed(2);
        if (headerTotalRate) headerTotalRate.value = totalRate.toFixed(2);
        if (headerGrandTotal) headerGrandTotal.value = grandTotal.toFixed(2);
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
            allLoadingSheets.unshift(sheetData);
            renderMainLoadingTable();

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

    function renderMainLoadingTable() {
        if (!loadingTableBody) return;
        
        loadingTableBody.innerHTML = allLoadingSheets.map((sheet, index) => `
            <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px; text-align: center;"><input type="checkbox"></td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-neutral-800);">${sheet.dcNo}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">${sheet.date}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-800);">${sheet.totalNos}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-800);">${sheet.totalCutting.toFixed(2)}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-800);">${sheet.totalRate.toFixed(2)}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-primary-900);">${sheet.grandTotal.toFixed(2)}</td>
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
                const sheet = allLoadingSheets[index];
                
                document.getElementById('header-dc-no').value = sheet.dcNo;
                document.getElementById('header-date').value = sheet.date;
                itemsList = [...sheet.items];
                
                renderEntryTable();
                updateHeaderStats();

                allLoadingSheets.splice(index, 1);
                renderMainLoadingTable();

                document.getElementById('nav-add-loading').click();
            });
        });

        // Attach View events
        loadingTableBody.querySelectorAll('.btn-view-sheet').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const sheet = allLoadingSheets[index];
                
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
                const sheet = allLoadingSheets[index];
                
                // Simple Print implementation
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>Loading Sheet - ${sheet.dcNo}</title>
                        <style>
                            body { font-family: sans-serif; padding: 40px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                            .totals { margin-top: 30px; text-align: right; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div>
                                <h1>LOADING SHEET</h1>
                                <p><strong>DC No:</strong> ${sheet.dcNo}</p>
                                <p><strong>Date:</strong> ${sheet.date}</p>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Item No</th>
                                    <th>Item Name</th>
                                    <th>NOS</th>
                                    <th>Cutting</th>
                                    <th>Rate</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sheet.items.map(item => `
                                    <tr>
                                        <td>${item.customer}</td>
                                        <td>${item.no}</td>
                                        <td>${item.name}</td>
                                        <td>${item.nos}</td>
                                        <td>${item.cutting}</td>
                                        <td>${item.rate.toFixed(2)}</td>
                                        <td>${item.total.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="totals">
                            <p><strong>Total NOS:</strong> ${sheet.totalNos}</p>
                            <p><strong>Grand Total:</strong> ₹${sheet.grandTotal.toFixed(2)}</p>
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

            // In a real app, you would call your backend here
            console.log('Saving Item:', { code, rate, dept, status });
            
            // Add to table (temporary local update)
            const tbody = document.getElementById('inventory-table-body');
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--color-neutral-100)';
            tr.style.transition = 'background 0.2s';
            tr.onmouseover = () => tr.style.background = '#f8fafc';
            tr.onmouseout = () => tr.style.background = 'transparent';
            tr.innerHTML = `
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-700);">${parseFloat(rate).toFixed(2)}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900);">${code}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">${dept}</td>
                <td style="padding: 16px;">
                    <span style="background: ${status === 'Active' ? 'var(--color-success-50)' : 'var(--color-primary-50)'}; 
                                 color: ${status === 'Active' ? 'var(--color-success-700)' : 'var(--color-primary-700)'}; 
                                 padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; 
                                 border: 1px solid ${status === 'Active' ? 'var(--color-success-200)' : 'var(--color-primary-200)'};">
                        ${status}
                    </span>
                </td>
                <td style="padding: 16px; text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-edit-inventory" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete-inventory" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.prepend(tr);
            
            // Close modal and reset form
            modal.style.display = 'none';
            form.reset();
            
            // UI Feedback
            alert('Item Code saved successfully!');
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

    // Seed data matching the user's screenshot
    const seedData = [
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

    tbody.innerHTML = seedData.map(item => `
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
    if (info) info.textContent = `Showing 1 to ${seedData.length} of ${seedData.length} entries`;
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
            const tbody = document.getElementById('dept-table-body');

            if (form.dataset.editMode === 'true' && window.currentEditDeptRow) {
                const cells = window.currentEditDeptRow.querySelectorAll('td');
                cells[1].textContent = name;
                delete form.dataset.editMode;
                window.currentEditDeptRow = null;
                form.querySelector('button[type="submit"]').textContent = 'Create Department';
                document.querySelector('#modal-add-dept h3').textContent = 'Create New Department';
            } else {
                const id = 'D-' + Math.floor(100 + Math.random() * 900);
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--color-neutral-100)';
                tr.style.transition = 'background 0.2s';
                tr.onmouseover = () => tr.style.background = '#f8fafc';
                tr.onmouseout = () => tr.style.background = 'transparent';
                tr.innerHTML = `
                    <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-500);">${id}</td>
                    <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900);">${name}</td>
                    <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">0</td>
                    <td style="padding: 16px;">
                        <span style="background: var(--color-success-50); color: var(--color-success-700); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; border: 1px solid var(--color-success-200);">Active</span>
                    </td>
                    <td style="padding: 16px; text-align: right;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button class="btn-edit-dept" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete-dept" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                tbody.prepend(tr);
            }
            
            modal.style.display = 'none';
            form.reset();
            alert('Department saved successfully!');
            updateDepartmentDropdowns(); // Sync dropdowns after saving a department
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

    const seedDepts = [
        { id: 'D-101', name: 'Production', employees: 45, status: 'Active' },
        { id: 'D-102', name: 'Sales', employees: 12, status: 'Active' },
        { id: 'D-103', name: 'Inventory', employees: 8, status: 'Active' },
        { id: 'D-104', name: 'Quality Control', employees: 15, status: 'Active' },
        { id: 'D-105', name: 'Packaging', employees: 20, status: 'Active' }
    ];

    tbody.innerHTML = seedDepts.map(dept => `
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

    updateDepartmentDropdowns(); // Initial sync after loading seed data
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

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('product-name-input').value;
            const code = document.getElementById('product-code-input').value;
            const hsn = document.getElementById('product-hsn-input').value;
            const rate = document.getElementById('product-rate-input').value;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--color-neutral-100)';
            tr.innerHTML = `
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900); border-bottom: 1px solid var(--color-neutral-100);">${name}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-100); text-transform: uppercase;">${code}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-100);">${hsn}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-neutral-900); border-bottom: 1px solid var(--color-neutral-100);">₹${parseFloat(rate).toFixed(2)}</td>
                <td style="padding: 16px; text-align: right; border-bottom: 1px solid var(--color-neutral-100);">
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-edit-product" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete-product" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.prepend(tr);
            modal.style.display = 'none';
            form.reset();
            alert('Product added successfully!');
        });
    }
    
    // Seed data
    if (tbody && tbody.children.length === 0) {
        const seedProducts = [
            { name: 'Hex Bolt M10 x 50', code: 'HB-M10-50', hsn: '7318', rate: 14.50 },
            { name: 'Self Tapping Screw', code: 'STS-08', hsn: '7318', rate: 2.80 },
            { name: 'Nylon Insert Lock Nut', code: 'NLN-M10', hsn: '7318', rate: 5.00 }
        ];
        seedProducts.forEach(p => {
             const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--color-neutral-100)';
            tr.innerHTML = `
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900); border-bottom: 1px solid var(--color-neutral-100);">${p.name}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-100); text-transform: uppercase;">${p.code}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); border-bottom: 1px solid var(--color-neutral-100);">${p.hsn}</td>
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-neutral-900); border-bottom: 1px solid var(--color-neutral-100);">₹${p.rate.toFixed(2)}</td>
                <td style="padding: 16px; text-align: right; border-bottom: 1px solid var(--color-neutral-100);">
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-edit-product" style="background: #3b82f6; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete-product" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
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
