/* ---- RDC (Returnable Delivery Challan) Logic ---- */
function initRDC() {
    const form = document.getElementById('form-add-rdc');
    const btnAddRow = document.getElementById('btn-rdc-add-row');
    const tbody = document.getElementById('rdc-items-body');
    const rdcListBody = document.getElementById('rdc-table-body');
    let currentEditIndex = -1;

    if (!form || !btnAddRow || !tbody) {
        console.warn('RDC form elements not found');
        return;
    }

    // Default date to today
    const dateInput = document.getElementById('rdc-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Navigation from List to Create
    const btnCreate = document.getElementById('btn-create-new-rdc');
    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            currentEditIndex = -1;
            form.reset();
            form.querySelector('h2').textContent = 'Create RDC';
            tbody.innerHTML = `<tr style="border-bottom: 1px solid var(--color-neutral-100);">${createRowHtml()}</tr>`;
            if (dateInput) dateInput.valueAsDate = new Date();
            
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const addPage = document.getElementById('page-add-rdc');
            if (addPage) addPage.classList.add('active');
        });
    }

    function createRowHtml(data = {}) {
        return `
            <td style="padding: 8px;"><input type="text" value="${data.product || ''}" placeholder="Product name" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
            <td style="padding: 8px;"><input type="text" value="${data.code || ''}" placeholder="Item Code" style="width: 100%; padding: 8px; border: 1px solid var(--color-neutral-200); border-radius: 4px;"></td>
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

    // Handle row removal
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-row');
        if (btn) btn.closest('tr').remove();
    });

    // --- Data Persistence ---
    const STORAGE_KEY = 'invoice_flow_rdcs';
    function getRDCs() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    function saveRDCs(rdcs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(rdcs)); }

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
            document.getElementById('rdc-no-manual').value = rdc.noFull.split('/')[1].substring(1);
            document.getElementById('rdc-date').value = rdc.date;
            document.getElementById('rdc-dept').value = rdc.dept;
            document.getElementById('rdc-customer').value = rdc.customer;
            document.getElementById('rdc-auto-delete-limit').value = rdc.autoDeleteLimit;
            
            tbody.innerHTML = rdc.items.map(item => `<tr style="border-bottom: 1px solid var(--color-neutral-100);">${createRowHtml(item)}</tr>`).join('');
            document.getElementById('page-add-rdc').querySelector('h2').textContent = 'Edit RDC';
            
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-add-rdc').classList.add('active');
        } else if (target.classList.contains('btn-view-rdc')) {
            const modal = document.getElementById('modal-view-details');
            document.getElementById('view-modal-title').textContent = `RDC: ${rdc.noFull}`;
            document.getElementById('view-modal-subtitle').textContent = `Date: ${rdc.date} | Dept: ${rdc.dept}`;
            
            const grid = document.getElementById('view-modal-header-grid');
            grid.innerHTML = `
                <div><label style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700">Customer</label><div style="font-weight:600">${rdc.customer}</div></div>
                <div><label style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700">Department</label><div style="font-weight:600">${rdc.dept}</div></div>
                <div><label style="display:block;font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:700">Auto Delete</label><div style="font-weight:600">${rdc.autoDeleteLimit} Days</div></div>
            `;
            
            const itemsBody = document.getElementById('view-modal-items-body');
            itemsBody.innerHTML = rdc.items.map((item, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0">
                    <td style="padding:12px 16px">${i+1}</td>
                    <td style="padding:12px 16px; font-weight:600">${item.product}</td>
                    <td style="padding:12px 16px; text-align:center">${item.qty}</td>
                    <td style="padding:12px 16px; text-align:center">${item.hsn} / ${item.code}</td>
                    <td style="padding:12px 16px; text-align:right">-</td>
                </tr>
            `).join('');
            
            modal.style.display = 'flex';
        }
    });

    // Handle Form Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const rdcData = {
            noFull: `CICRDI/0${document.getElementById('rdc-no-manual').value || '00000'}/26`,
            date: document.getElementById('rdc-date').value,
            dept: document.getElementById('rdc-dept').value,
            customer: document.getElementById('rdc-customer').value,
            autoDeleteLimit: document.getElementById('rdc-auto-delete-limit').value,
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
        alert(currentEditIndex > -1 ? 'RDC Updated!' : 'RDC Created!');
        renderRDCs();
        document.getElementById('nav-rdc').click();
        form.reset();
    });

    renderRDCs();
}
