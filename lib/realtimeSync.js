/**
 * Real-time Sync Manager - Subscribe to Supabase changes and sync across users
 * Enables real-time updates when any user makes changes
 */

class RealtimeSync {
    constructor(supabase) {
        this.supabase = supabase;
        this.subscriptions = new Map();
        this.listeners = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize real-time sync
     */
    async init() {
        if (!this.supabase) {
            console.warn('⚠ Supabase not available for real-time sync');
            return false;
        }

        this.isInitialized = true;
        console.log('✓ Real-time sync initialized');
        return true;
    }

    /**
     * Subscribe to changes in a specific table
     * @param {string} tableName - Table name to watch
     * @param {function} callback - Function to call on changes (payload)
     * @param {object} options - Options: { event: 'INSERT|UPDATE|DELETE|*', schema: 'public' }
     */
    subscribeToTable(tableName, callback, options = {}) {
        if (!this.supabaseClient) {
            console.warn('⚠ Supabase not available');
            return null;
        }

        const { event = '*', schema = 'public' } = options;

        try {
            const channelName = `${tableName}-changes`;
            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event,
                        schema,
                        table: tableName
                    },
                    (payload) => {
                        console.log(`Real-time update on ${tableName}:`, payload);
                        callback(payload);
                    }
                )
                .subscribe();

            // Store subscription
            if (!this.subscriptions.has(tableName)) {
                this.subscriptions.set(tableName, []);
            }
            this.subscriptions.get(tableName).push({ channel, callback });

            console.log(`✓ Subscribed to ${tableName} changes`);
            return channel;
        } catch (error) {
            console.error(`Failed to subscribe to ${tableName}:`, error);
            return null;
        }
    }

    /**
     * Subscribe to company-specific changes
     * Only receives updates for a specific company
     * @param {string} companyId - Company ID to monitor
     * @param {function} callback - Function to call on changes
     */
    subscribeToCompanyActivity(companyId, callback) {
        if (!this.supabase) {
            console.warn('⚠ Supabase not available');
            return null;
        }

        try {
            const channelName = `company-activity-${companyId}`;
            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'activity_logs',
                        filter: `company_id=eq.${companyId}`
                    },
                    (payload) => {
                        console.log(`New activity for company ${companyId}:`, payload);
                        callback(payload.new);
                    }
                )
                .subscribe();

            this.subscriptions.set(channelName, [{ channel, callback }]);
            console.log(`✓ Subscribed to activity for company ${companyId}`);
            return channel;
        } catch (error) {
            console.error('Failed to subscribe to company activity:', error);
            return null;
        }
    }

    /**
     * Subscribe to invoices for a specific company
     * @param {string} companyId - Company ID
     * @param {function} callback - Callback function
     */
    subscribeToInvoices(companyId, callback) {
        if (!this.supabase) return null;

        try {
            const channelName = `invoices-${companyId}`;
            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'invoices',
                        filter: `company_id=eq.${companyId}`
                    },
                    (payload) => {
                        console.log('Invoice updated:', payload);
                        callback(payload);
                    }
                )
                .subscribe();

            this.subscriptions.set(channelName, [{ channel, callback }]);
            return channel;
        } catch (error) {
            console.error('Failed to subscribe to invoices:', error);
            return null;
        }
    }

    /**
     * Subscribe to delivery challans for a specific company
     * @param {string} companyId - Company ID
     * @param {function} callback - Callback function
     */
    subscribeToDeliveryChallans(companyId, callback) {
        if (!this.supabase) return null;

        try {
            const channelName = `challans-${companyId}`;
            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'delivery_challans',
                        filter: `company_id=eq.${companyId}`
                    },
                    (payload) => {
                        console.log('Delivery Challan updated:', payload);
                        callback(payload);
                    }
                )
                .subscribe();

            this.subscriptions.set(channelName, [{ channel, callback }]);
            return channel;
        } catch (error) {
            console.error('Failed to subscribe to delivery challans:', error);
            return null;
        }
    }

    /**
     * Unsubscribe from a specific table
     * @param {string} tableName - Table name to unsubscribe from
     */
    unsubscribeFromTable(tableName) {
        const subs = this.subscriptions.get(tableName);
        if (subs) {
            subs.forEach(({ channel }) => {
                if (this.supabase) {
                    this.supabase.removeChannel(channel);
                }
            });
            this.subscriptions.delete(tableName);
            console.log(`✓ Unsubscribed from ${tableName}`);
        }
    }

    /**
     * Unsubscribe from all subscriptions
     */
    unsubscribeAll() {
        this.subscriptions.forEach((subs, tableName) => {
            subs.forEach(({ channel }) => {
                if (this.supabase) {
                    this.supabase.removeChannel(channel);
                }
            });
        });
        this.subscriptions.clear();
        console.log('✓ Unsubscribed from all tables');
    }

    /**
     * Check if subscribed to a table
     * @param {string} tableName
     * @returns {boolean}
     */
    isSubscribedTo(tableName) {
        return this.subscriptions.has(tableName) && this.subscriptions.get(tableName).length > 0;
    }

    /**
     * Get all active subscriptions
     * @returns {array} Array of subscription names
     */
    getActiveSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }

    /**
     * Cleanup all subscriptions
     */
    destroy() {
        this.unsubscribeAll();
        this.listeners.clear();
        console.log('✓ Real-time sync destroyed');
    }
}

// Create and export singleton (will be initialized after supabase is available)
window.realtimeSync = null;

/**
 * Initialize real-time sync after Supabase is ready
 */
function initRealtimeSync() {
    if (window.supabaseClient) {
        window.realtimeSync = new RealtimeSync(window.supabaseClient);
        window.realtimeSync.init();
    }
}
