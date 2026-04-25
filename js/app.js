/* ========================================
   Invoice Flow - App JavaScript
   ======================================== */

// --- 1. API CONFIG ---
// Change this to your Vercel backend URL after deployment
// For local dev: 'http://localhost:3000'
// For production: 'https://your-backend.vercel.app'
const API_BASE = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing App');
    initVendorForm();
    initDCForm();
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

            // Update search placeholder
            if (searchInput && searchPlaceholders[pageName]) {
                searchInput.placeholder = searchPlaceholders[pageName];
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
    btnAddRow.addEventListener('click', () => {
        const newRow = document.createElement('tr');
        newRow.style.borderBottom = '1px solid var(--color-neutral-100)';
        newRow.innerHTML = `
            <td style="padding: 8px;"><input type="text" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" class="btn-remove-row" style="background: #fee2e2; color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;"><i class="fas fa-times"></i></button>
            </td>
        `;
        tbody.appendChild(newRow);
    });

    // Handle removing row
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-row');
        if (btn) {
            btn.closest('tr').remove();
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
        const dcNo = "DC-" + Math.floor(1000 + Math.random() * 9000) + "/25-26";

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
                items.push(item);
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
                const oldData = JSON.parse(targetRow.dataset.dcData);
                finalDcNo = oldData.dcNo; // Keep original DC number
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
                    <td style="padding: 6px; border-right: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
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
