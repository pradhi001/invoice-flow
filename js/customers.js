/* ---- Customers Management ---- */
function initCustomers() {
    const modal = document.getElementById('modal-add-customer');
    const btnAdd = document.getElementById('btn-add-customer');
    const form = document.getElementById('form-add-customer');
    const tbody = document.getElementById('customers-table-body');
    const searchInput = document.getElementById('search-customers');

    if (!tbody) return;

    const STORAGE_KEY = 'invoice_flow_customers';
    const getCustomers = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const saveCustomers = (customers) => localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));

    function renderCustomers(filter = '') {
        const customers = getCustomers();
        const filtered = customers.filter(c => 
            c.name.toLowerCase().includes(filter.toLowerCase()) || 
            c.contact.toLowerCase().includes(filter.toLowerCase()) ||
            c.gst.toLowerCase().includes(filter.toLowerCase()) ||
            c.location.toLowerCase().includes(filter.toLowerCase())
        );

        if (filtered.length === 0 && filter === '') {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--color-neutral-400);">No customers found. Add your first customer.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((c, index) => `
            <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px; font-size: 0.875rem; font-weight: 600; color: var(--color-primary-900);">${c.name}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-700);">${c.contact}<br><small style="color: var(--color-neutral-400)">${c.phone}</small></td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600); text-transform: uppercase;">${c.gst || 'N/A'}</td>
                <td style="padding: 16px; font-size: 0.875rem; color: var(--color-neutral-600);">${c.location}</td>
                <td style="padding: 16px; text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-delete-customer" data-index="${index}" style="background: #fee2e2; color: #ef4444; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    if (btnAdd && modal) {
        btnAdd.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const customer = {
                name: document.getElementById('customer-name-input').value,
                contact: document.getElementById('customer-contact-input').value,
                phone: document.getElementById('customer-phone-input').value,
                gst: document.getElementById('customer-gst-input').value.toUpperCase(),
                location: document.getElementById('customer-location-input').value,
                createdAt: new Date().getTime()
            };

            const customers = getCustomers();
            customers.unshift(customer);
            saveCustomers(customers);
            
            modal.style.display = 'none';
            form.reset();
            renderCustomers();
            alert('Customer added successfully!');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCustomers(e.target.value);
        });
    }

    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-customer');
            if (deleteBtn) {
                if (confirm('Are you sure you want to delete this customer?')) {
                    const index = parseInt(deleteBtn.dataset.index);
                    const customers = getCustomers();
                    customers.splice(index, 1);
                    saveCustomers(customers);
                    renderCustomers();
                }
            }
        });
    }

    // Seed data if empty
    if (getCustomers().length === 0) {
        const seed = [
            { name: 'Skyline Modernity Ltd.', contact: 'Ramesh Kumar', phone: '9123456789', gst: '33ABCDE1234F1Z1', location: 'Hosur, TN' },
            { name: 'Vista Housing Co.', contact: 'Priya Singh', phone: '9876543210', gst: '33FGHIJ5678K1Z2', location: 'Bangalore, KA' }
        ];
        saveCustomers(seed);
    }

    renderCustomers();
}
