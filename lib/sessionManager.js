/** Session facade backed by Supabase Auth. Business records remain in localStorage. */
class SessionManager {
    constructor() {
        this.currentUser = null;
        this.currentCompanies = [];
    }

    get auth() {
        const client = window.supabaseClient;
        if (!client?.auth) throw new Error('Secure sign-in is unavailable.');
        return client.auth;
    }

    async init() {
        const { data, error } = await this.auth.getSession();
        if (error) throw error;
        const user = data.session?.user || null;
        if (user && user.app_metadata?.invoice_flow_access !== true) {
            const { error: signOutError } = await this.auth.signOut();
            if (signOutError) throw signOutError;
            this.currentUser = null;
            return null;
        }
        this.currentUser = user;
        return this.currentUser;
    }

    async login(email, password) {
        const { data, error } = await this.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const user = data.user;
        if (!user || user.app_metadata?.invoice_flow_access !== true) {
            await this.auth.signOut();
            throw new Error('This account is not authorized to use Invoice Flow.');
        }
        this.currentUser = user;
        return user;
    }

    isAdmin() {
        return this.currentUser?.app_metadata?.role === 'admin';
    }

    getUserId() {
        return this.currentUser?.id;
    }

    getUsername() {
        return this.currentUser?.email || '';
    }

    getCompanies() {
        return this.currentCompanies;
    }

    canViewCompany(companyId) {
        return Boolean(this.currentUser && companyId);
    }

    getUserType() {
        return this.isAdmin() ? 'admin' : 'user';
    }

    async logout() {
        const { error } = await this.auth.signOut();
        if (error) throw error;
        this.currentUser = null;
        this.currentCompanies = [];
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    async refreshCompanies() {
        return this.currentCompanies;
    }
}

window.sessionManager = new SessionManager();
