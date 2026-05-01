/**
 * Session Manager - Handle user login, current user state, and visibility
 * Manages who's logged in and which companies they have access to
 */

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.currentCompanies = [];
        this.apiBase = 'https://invoice-flow-pradhi.vercel.app'; // Update to your API base
    }

    /**
     * Initialize session from stored data
     */
    async init() {
        const storedUser = localStorage.getItem('invoice_flow_current_user');
        if (storedUser) {
            try {
                this.currentUser = JSON.parse(storedUser);
                await this.loadUserCompanies();
                console.log('✓ Session restored for:', this.currentUser.username);
            } catch (error) {
                console.error('Failed to restore session:', error);
                this.logout();
            }
        }
    }

    /**
     * Login user with credentials
     * @param {string} username
     * @param {string} password
     * @returns {Promise<object>} User object
     */
    async login(username, password) {
        try {
            const response = await fetch(`${this.apiBase}/api/team_members`, {
                method: 'GET'
            });

            if (!response.ok) throw new Error('Failed to fetch users');

            const users = await response.json();
            const user = users.find(u => u.username === username && u.password === password);

            if (!user) {
                throw new Error('Invalid username or password');
            }

            this.currentUser = user;
            localStorage.setItem('invoice_flow_current_user', JSON.stringify(user));
            await this.loadUserCompanies();

            console.log('✓ Login successful:', username);
            return user;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    /**
     * Load companies assigned to current user
     * @private
     */
    async loadUserCompanies() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(
                `${this.apiBase}/api/companies?user_id=${this.currentUser.id}`,
                { method: 'GET' }
            );

            if (!response.ok) throw new Error('Failed to fetch companies');

            const { companies } = await response.json();
            this.currentCompanies = companies || [];
            localStorage.setItem('invoice_flow_user_companies', JSON.stringify(this.currentCompanies));

            console.log('✓ Loaded companies:', this.currentCompanies.length);
        } catch (error) {
            console.error('Failed to load companies:', error);
            this.currentCompanies = [];
        }
    }

    /**
     * Check if current user is admin
     * @returns {boolean}
     */
    isAdmin() {
        return this.currentUser?.user_type === 'admin';
    }

    /**
     * Get current user ID
     * @returns {string} User ID
     */
    getUserId() {
        return this.currentUser?.id;
    }

    /**
     * Get current username
     * @returns {string} Username
     */
    getUsername() {
        return this.currentUser?.username;
    }

    /**
     * Get all companies accessible by current user
     * @returns {array} Companies
     */
    getCompanies() {
        return this.currentCompanies;
    }

    /**
     * Check if user can view specific company
     * @param {string} companyId - Company ID to check
     * @returns {boolean}
     */
    canViewCompany(companyId) {
        if (this.isAdmin()) return true;
        return this.currentCompanies.some(c => c.id === companyId);
    }

    /**
     * Get user type (admin or user)
     * @returns {string}
     */
    getUserType() {
        return this.currentUser?.user_type || 'user';
    }

    /**
     * Logout current user
     */
    logout() {
        this.currentUser = null;
        this.currentCompanies = [];
        localStorage.removeItem('invoice_flow_current_user');
        localStorage.removeItem('invoice_flow_user_companies');
        console.log('✓ Logged out');
    }

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }

    /**
     * Refresh companies (useful after admin assigns new companies)
     */
    async refreshCompanies() {
        await this.loadUserCompanies();
    }
}

// Create and export singleton
window.sessionManager = new SessionManager();
