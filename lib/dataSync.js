/**
 * Data Sync Utilities - Helpers for fetching and syncing data with server
 * Replaces localStorage-based data with Supabase API calls
 */

const DataSync = {
    /**
     * Load companies for current user
     */
    async loadCompanies() {
        const userId = window.sessionManager?.getUserId();
        if (!userId) {
            console.warn('No user logged in');
            return [];
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/companies?user_id=${userId}`,
                { method: 'GET' }
            );

            if (!response.ok) throw new Error('Failed to fetch companies');

            const { companies } = await response.json();
            return companies || [];
        } catch (error) {
            console.error('Failed to load companies:', error);
            // Fallback to localStorage
            const cached = localStorage.getItem('invoice_flow_user_companies');
            return cached ? JSON.parse(cached) : [];
        }
    },

    /**
     * Load invoices for a company
     */
    async loadInvoices(companyId) {
        if (!window.sessionManager?.canViewCompany(companyId)) {
            console.error('Access denied to company:', companyId);
            return [];
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/invoices?company_id=${companyId}`,
                { method: 'GET' }
            );

            if (!response.ok) throw new Error('Failed to fetch invoices');

            const { invoices } = await response.json();
            return invoices || [];
        } catch (error) {
            console.error('Failed to load invoices:', error);
            return [];
        }
    },

    /**
     * Create a new invoice
     */
    async createInvoice(invoiceData) {
        const userId = window.sessionManager?.getUserId();
        if (!userId) throw new Error('User not logged in');

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/invoices`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...invoiceData,
                        created_by: userId
                    })
                }
            );

            if (!response.ok) throw new Error('Failed to create invoice');

            const { invoice } = await response.json();
            console.log('✓ Invoice created:', invoice.id);
            return invoice;
        } catch (error) {
            console.error('Failed to create invoice:', error);
            throw error;
        }
    },

    /**
     * Update an invoice
     */
    async updateInvoice(invoiceId, updates) {
        const userId = window.sessionManager?.getUserId();
        if (!userId) throw new Error('User not logged in');

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/invoices?id=${invoiceId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...updates,
                        updated_by: userId
                    })
                }
            );

            if (!response.ok) throw new Error('Failed to update invoice');

            const { invoice } = await response.json();
            console.log('✓ Invoice updated:', invoiceId);
            return invoice;
        } catch (error) {
            console.error('Failed to update invoice:', error);
            throw error;
        }
    },

    /**
     * Load activity logs for a company
     */
    async loadActivityLogs(companyId, limit = 50, offset = 0) {
        const userId = window.sessionManager?.getUserId();
        if (!userId) return [];

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/activity_logs?user_id=${userId}&company_id=${companyId}&limit=${limit}&offset=${offset}`,
                { method: 'GET' }
            );

            if (!response.ok) throw new Error('Failed to fetch activity logs');

            const { activities } = await response.json();
            return activities || [];
        } catch (error) {
            console.error('Failed to load activity logs:', error);
            return [];
        }
    },

    /**
     * Create new user (admin only)
     */
    async createUser(username, password, companyIds = []) {
        const userId = window.sessionManager?.getUserId();
        if (!userId) throw new Error('User not logged in');

        if (!window.sessionManager?.isAdmin()) {
            throw new Error('Only admins can create users');
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/team_members`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        user_type: 'user',
                        company_ids: companyIds,
                        created_by: userId
                    })
                }
            );

            if (!response.ok) throw new Error('Failed to create user');

            const user = await response.json();
            console.log('✓ User created:', username);
            return user;
        } catch (error) {
            console.error('Failed to create user:', error);
            throw error;
        }
    },

    /**
     * Assign companies to user (admin only)
     */
    async assignCompaniesToUser(userId, companyIds) {
        const currentUserId = window.sessionManager?.getUserId();
        if (!currentUserId) throw new Error('User not logged in');

        if (!window.sessionManager?.isAdmin()) {
            throw new Error('Only admins can assign companies');
        }

        try {
            const response = await fetch(
                `${getApiBaseUrl()}/api/team_members`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: userId,
                        company_ids: companyIds,
                        updated_by: currentUserId
                    })
                }
            );

            if (!response.ok) throw new Error('Failed to assign companies');

            console.log('✓ Companies assigned to user');
            return await response.json();
        } catch (error) {
            console.error('Failed to assign companies:', error);
            throw error;
        }
    },

    /**
     * Get API base URL
     */
    getApiBaseUrl() {
        return window.API_BASE || 'https://invoice-flow-pradhi.vercel.app';
    }
};

/**
 * Helper to get API base URL (for use in fetch calls)
 */
function getApiBaseUrl() {
    return DataSync.getApiBaseUrl();
}
