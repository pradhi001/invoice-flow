/* ---- RDC (Returnable Delivery Challan) Logic ---- */
function initRDC() {
    const form = document.getElementById('form-add-rdc');
    const btnAddRow = document.getElementById('btn-rdc-add-row');
    const tbody = document.getElementById('rdc-items-body');
    const rdcListBody = document.getElementById('rdc-table-body');
    const btnSelectCustomer = document.getElementById('btn-select-customer-rdc');
    let currentEditIndex = -1;
    let currentRowToFill = null;

    if (!form || !btnAddRow || !tbody) {
        console.warn('RDC form elements not found');
        return;
    }

    // Default date to today
    const dateInput = document.getElementById('rdc-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Set default auto-delete limit
    const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
    const autoDeleteInput = document.getElementById('rdc-auto-delete-limit');
    if (autoDeleteInput && profile.rdcLimit) {
        autoDeleteInput.value = profile.rdcLimit;
    }

    function populateSuppliers() {
        const supplierSelect = document.getElementById('rdc-customer');
        if (supplierSelect) {
            const suppliers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            const profile = JSON.parse(localStorage.getItem('invoice_flow_company_profile') || '{}');
            const currentVal = supplierSelect.value;
            supplierSelect.innerHTML = '<option value="">Select Supplier</option>' + 
                suppliers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            
            if (currentVal) {
                supplierSelect.value = currentVal;
            } else if (profile.defaultCustomer) {
                supplierSelect.value = profile.defaultCustomer;
            }
        }
    }
    populateSuppliers();

    // Navigation from List to Create
    const btnCreate = document.getElementById('btn-create-new-rdc');
    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            currentEditIndex = -1;
            form.reset();
            populateSuppliers();
            const h2 = document.getElementById('page-add-rdc')?.querySelector('h2');
            if (h2) h2.textContent = 'Create RDC';
            tbody.innerHTML = `<tr style="border-bottom: 1px solid var(--color-neutral-100);">${createRowHtml()}</tr>`;
            if (dateInput) dateInput.valueAsDate = new Date();
            
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const addPage = document.getElementById('page-add-rdc');
            if (addPage) addPage.classList.add('active');
        });
    }

    function createRowHtml(data = {}) {
        return `
            <td style="padding: 8px;"><input type="text" value="${data.product || ''}" placeholder="Enter product name" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;">
                <div style="display: flex; gap: 4px;">
                    <input type="text" value="${data.code || ''}" placeholder="Item Code" style="flex: 1; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px; min-width: 0;">
                    <button type="button" class="btn-select-product" style="padding: 8px; background: var(--color-primary-50); color: var(--color-primary-600); border: 1px solid var(--color-primary-200); border-radius: 4px; cursor: pointer; transition: 0.2s;" title="Select Product">
                        <i class="fas fa-list"></i>
                    </button>
                </div>
            </td>
            <td style="padding: 8px;"><input type="text" value="${data.hsn || ''}" placeholder="HSN" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="number" value="${data.qty || ''}" placeholder="0" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px; text-align: center;"></td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" class="btn-remove-row" style="background: #fee2e2; color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;"><i class="fas fa-times"></i></button>
            </td>
        `;
    }

    // Handle adding new row
    btnAddRow.addEventListener('click', () => {
        const newRow = document.createElement('tr');
        newRow.style.borderBottom = '1px solid var(--color-neutral-100)';
        newRow.innerHTML = createRowHtml();
        tbody.appendChild(newRow);
    });

    // Handle row removal and product selection
    tbody.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-row');
        if (removeBtn) removeBtn.closest('tr').remove();

        const selectBtn = e.target.closest('.btn-select-product');
        if (selectBtn) {
            currentRowToFill = selectBtn.closest('tr');
            openProductPicker();
        }
    });

    // --- Product Picker Logic ---
    const productPickerModal = document.getElementById('modal-product-picker');
    const productPickerBody = document.getElementById('product-picker-body');
    const productPickerSearch = document.getElementById('product-picker-search');

    function openProductPicker() {
        if (!productPickerModal) return;
        const products = JSON.parse(localStorage.getItem('invoice_flow_products') || '[]');
        const sampleProducts = [
            { name: 'Hex Bolt M10 x 50', code: 'BOLT-1050', hsn: '73181500' },
            { name: 'Nylon Lock Nut M10', code: 'NUT-10N', hsn: '73181600' },
            { name: 'Flat Washer M10', code: 'WASH-10', hsn: '73182200' }
        ];
        renderProductPicker(products.length > 0 ? products : sampleProducts);
        productPickerModal.style.display = 'flex';
    }

    function renderProductPicker(products) {
        if (!productPickerBody) return;
        productPickerBody.innerHTML = products.map(p => `
            <tr style="border-bottom: 1px solid #f1f5f9; cursor: pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px; font-size: 0.875rem; font-weight: 600;">${p.name}</td>
                <td style="padding: 12px; font-size: 0.875rem;">${p.code}</td>
                <td style="padding: 12px; font-size: 0.875rem;">${p.hsn}</td>
                <td style="padding: 12px; text-align: center;">
                    <button type="button" class="btn-pick-product" data-name="${p.name}" data-code="${p.code}" data-hsn="${p.hsn}" style="background: var(--color-primary-900); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Select</button>
                </td>
            </tr>
        `).join('');
    }

    if (productPickerSearch) {
        productPickerSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const products = JSON.parse(localStorage.getItem('invoice_flow_products') || '[]');
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.code.toLowerCase().includes(query) || 
                p.hsn.toLowerCase().includes(query)
            );
            renderProductPicker(filtered);
        });
    }

    if (productPickerModal) {
        productPickerModal.addEventListener('click', (e) => {
            const pickBtn = e.target.closest('.btn-pick-product');
            if (pickBtn && currentRowToFill) {
                const inputs = currentRowToFill.querySelectorAll('input');
                inputs[0].value = pickBtn.dataset.name;
                inputs[1].value = pickBtn.dataset.code;
                inputs[2].value = pickBtn.dataset.hsn;
                productPickerModal.style.display = 'none';
            }
        });
    }

    // --- Customer Picker Logic ---
    const customerPickerModal = document.getElementById('modal-customer-picker');
    const customerPickerBody = document.getElementById('customer-picker-body');
    const customerPickerSearch = document.getElementById('customer-picker-search');

    if (btnSelectCustomer) {
        btnSelectCustomer.addEventListener('click', () => {
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            renderCustomerPicker(customers);
            customerPickerModal.style.display = 'flex';
        });
    }

    function renderCustomerPicker(customers) {
        if (!customerPickerBody) return;
        customerPickerBody.innerHTML = customers.map(c => `
            <tr style="border-bottom: 1px solid #f1f5f9; cursor: pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px; font-size: 0.875rem; font-weight: 600;">${c.name}</td>
                <td style="padding: 12px; font-size: 0.875rem;">${c.location}</td>
                <td style="padding: 12px; text-align: center;">
                    <button type="button" class="btn-pick-customer" data-name="${c.name}" style="background: var(--color-primary-900); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Select</button>
                </td>
            </tr>
        `).join('');
    }

    if (customerPickerSearch) {
        customerPickerSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            const filtered = customers.filter(c => c.name.toLowerCase().includes(query) || c.location.toLowerCase().includes(query));
            renderCustomerPicker(filtered);
        });
    }

    if (customerPickerModal) {
        customerPickerModal.addEventListener('click', (e) => {
            const pickBtn = e.target.closest('.btn-pick-customer');
            if (pickBtn) {
                const customerInput = document.getElementById('rdc-customer');
                if (customerInput) customerInput.value = pickBtn.dataset.name;
                customerPickerModal.style.display = 'none';
            }
        });
    }

    // --- Data Persistence ---
    const STORAGE_KEY = 'invoice_flow_rdcs';
    const getRDCs = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const saveRDCs = (rdcs) => localStorage.setItem(STORAGE_KEY, JSON.stringify(rdcs));

    function renderRDCs() {
        if (!rdcListBody) return;
        let rdcs = getRDCs();
        const now = new Date();
        
        // Auto-Delete filter
        rdcs = rdcs.filter(rdc => {
            const limit = parseInt(rdc.autoDeleteLimit || '90');
            const diffDays = Math.floor((now - new Date(rdc.date)) / (1000 * 60 * 60 * 24));
            return diffDays <= limit;
        });
        saveRDCs(rdcs);

        if (rdcs.length === 0) {
            rdcListBody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No RDCs found. Create one to get started.</td></tr>`;
            return;
        }

        rdcListBody.innerHTML = rdcs.map((rdc, index) => {
            const limit = parseInt(rdc.autoDeleteLimit || '90');
            const diffDays = Math.floor((now - new Date(rdc.date)) / (1000 * 60 * 60 * 24));
            const daysLeft = limit - diffDays;
            const statusColor = daysLeft <= 10 ? '#ef4444' : (daysLeft <= 30 ? '#f59e0b' : 'var(--color-primary-600)');

            return `
                <tr style="border-bottom: 1px solid var(--color-neutral-100);">
                    <td style="padding: 16px; font-size: 0.875rem;">${rdc.date}</td>
                    <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: var(--color-primary-900);">${rdc.noFull}</td>
                    <td style="padding: 16px; font-size: 0.875rem;">${rdc.customer} (${rdc.dept})</td>
                    <td style="padding: 16px; font-size: 0.875rem;">${rdc.items.length} Items</td>
                    <td style="padding: 16px; font-size: 0.875rem; font-weight: 700; color: ${statusColor};">${daysLeft > 0 ? `${daysLeft} days left` : 'Expiring today'}</td>
                    <td style="padding: 16px; text-align: right;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button class="btn-icon btn-view-rdc" data-index="${index}" style="color: var(--color-primary-600); background: none; border: none; cursor: pointer; font-size: 1rem;" title="View"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon btn-edit-rdc" data-index="${index}" style="color: var(--color-neutral-600); background: none; border: none; cursor: pointer; font-size: 1rem;" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon btn-delete-rdc" data-index="${index}" style="color: #ef4444; background: none; border: none; cursor: pointer; font-size: 1rem;" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Handle List Actions
    rdcListBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const index = parseInt(target.dataset.index);
        const rdcs = getRDCs();
        const rdc = rdcs[index];

        if (target.classList.contains('btn-delete-rdc')) {
            if (confirm('Delete this RDC?')) {
                rdcs.splice(index, 1);
                saveRDCs(rdcs);
                renderRDCs();
            }
        } else if (target.classList.contains('btn-edit-rdc')) {
            currentEditIndex = index;
            const rdcNoInput = document.getElementById('rdc-no-manual');
            if (rdcNoInput) {
                const parts = rdc.noFull.split('/');
                if (parts[1]) rdcNoInput.value = parts[1].substring(1);
            }
            if (document.getElementById('rdc-date')) document.getElementById('rdc-date').value = rdc.date;
            if (document.getElementById('rdc-dept')) document.getElementById('rdc-dept').value = rdc.dept;
            if (document.getElementById('rdc-customer')) document.getElementById('rdc-customer').value = rdc.customer;
            if (document.getElementById('rdc-auto-delete-limit')) document.getElementById('rdc-auto-delete-limit').value = rdc.autoDeleteLimit;
            
            tbody.innerHTML = rdc.items.map(item => `<tr style="border-bottom: 1px solid var(--color-neutral-100);">${createRowHtml(item)}</tr>`).join('');
            const h2 = document.getElementById('page-add-rdc')?.querySelector('h2');
            if (h2) h2.textContent = 'Edit RDC';
            
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-add-rdc').classList.add('active');
        } else if (target.classList.contains('btn-view-rdc')) {
            const modal = document.getElementById('modal-view-details');
            const title = document.getElementById('view-modal-title');
            const subtitle = document.getElementById('view-modal-subtitle');
            if (title) title.textContent = `RDC: ${rdc.noFull}`;
            if (subtitle) subtitle.textContent = `Date: ${rdc.date} | Dept: ${rdc.dept}`;
            
            const grid = document.getElementById('view-modal-header-grid');
            if (grid) {
                grid.innerHTML = `
                    <div><label style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700">Customer</label><div style="font-weight:600">${rdc.customer}</div></div>
                    <div><label style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700">Department</label><div style="font-weight:600">${rdc.dept}</div></div>
                    <div><label style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700">Auto Delete</label><div style="font-weight:600">${rdc.autoDeleteLimit} Days</div></div>
                `;
            }
            
            const itemsBody = document.getElementById('view-modal-items-body');
            if (itemsBody) {
                itemsBody.innerHTML = rdc.items.map((item, i) => `
                    <tr style="border-bottom: 1px solid #e2e8f0">
                        <td style="padding:12px 16px">${i+1}</td>
                        <td style="padding:12px 16px; font-weight:600">${item.product}</td>
                        <td style="padding:12px 16px; text-align:center">${item.qty}</td>
                        <td style="padding:12px 16px; text-align:center">${item.hsn} / ${item.code}</td>
                        <td style="padding:12px 16px; text-align:right">-</td>
                    </tr>
                `).join('');
            }
            
            if (modal) modal.style.display = 'flex';
        }
    });

    // Handle Form Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const manualNoEl = document.getElementById('rdc-no-manual');
        const dateEl = document.getElementById('rdc-date');
        const deptEl = document.getElementById('rdc-dept');
        const customerEl = document.getElementById('rdc-customer');
        const autoDeleteEl = document.getElementById('rdc-auto-delete-limit');

        if (!manualNoEl || !dateEl || !deptEl || !customerEl || !autoDeleteEl) {
            console.error('One or more form elements missing');
            return;
        }

        const rdcData = {
            noFull: `CICRDI/0${manualNoEl.value || '00000'}/26`,
            date: dateEl.value,
            dept: deptEl.value,
            customer: customerEl.value,
            autoDeleteLimit: autoDeleteEl.value,
            items: Array.from(tbody.querySelectorAll('tr')).map(row => {
                const inputs = row.querySelectorAll('input');
                return { product: inputs[0].value, code: inputs[1].value, hsn: inputs[2].value, qty: inputs[3].value };
            }).filter(item => item.product),
            createdAt: new Date().getTime()
        };

        if (rdcData.items.length === 0) return alert('Add at least one product.');

        const rdcs = getRDCs();
        if (currentEditIndex > -1) rdcs[currentEditIndex] = rdcData;
        else rdcs.unshift(rdcData);
        
        saveRDCs(rdcs);
        
        // Sync to Supabase
        if (typeof apiFetch === 'function') {
            const customers = JSON.parse(localStorage.getItem('invoice_flow_customers') || '[]');
            const customer = customers.find(c => c.name === rdcData.customer);
            apiFetch('rdcs', {
                method: 'POST',
                body: JSON.stringify({
                    rdc_number: rdcData.noFull,
                    company_id: customer ? customer.id : null,
                    dept: rdcData.dept,
                    date: rdcData.date,
                    items: rdcData.items,
                    auto_delete_limit: rdcData.autoDeleteLimit
                })
            });
        }

        alert(currentEditIndex > -1 ? 'RDC Updated!' : 'RDC Created!');
        renderRDCs();
        
        // Return to list
        const navRdc = document.getElementById('nav-rdc');
        if (navRdc) navRdc.click();
        else {
            // Fallback: manually switch page
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-rdc').classList.add('active');
        }
        
        form.reset();
    });

    renderRDCs();
}
