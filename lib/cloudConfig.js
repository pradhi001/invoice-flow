/**
 * Frontend Cloud Configuration
 * Handles environment detection and API configuration for cloud deployment
 */

class CloudConfig {
    constructor() {
        this.environment = this.detectEnvironment();
        this.apiBase = this.getApiBase();
        this.supabaseUrl = this.getSupabaseUrl();
        this.supabaseKey = this.getSupabaseKey();
        this.initialized = false;
    }

    /**
     * Detect current environment (development, staging, production)
     */
    detectEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        
        if (hostname.includes('vercel') || hostname.includes('vercel.app')) {
            return 'production';
        }
        
        return 'staging';
    }

    /**
     * Get the correct API base URL for current environment
     */
    getApiBase() {
        // Try to get from window object (set by parent script)
        if (window.API_BASE) {
            return window.API_BASE;
        }
        
        // Try to get from meta tag
        const metaTag = document.querySelector('meta[name="api-base"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        // Environment-specific defaults
        switch (this.environment) {
            case 'production':
                // Use relative paths for same-origin API calls
                return window.location.origin;
            case 'development':
                return 'http://localhost:3000';
            case 'staging':
                return `https://${window.location.hostname}`;
            default:
                return window.location.origin;
        }
    }

    /**
     * Get Supabase URL
     */
    getSupabaseUrl() {
        // Try to get from window object
        if (window.SUPABASE_URL) {
            return window.SUPABASE_URL;
        }
        
        // Try to get from meta tag
        const metaTag = document.querySelector('meta[name="supabase-url"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        return '';
    }

    /**
     * Get Supabase key
     */
    getSupabaseKey() {
        // Try to get from window object
        if (window.SUPABASE_KEY) {
            return window.SUPABASE_KEY;
        }
        
        // Try to get from meta tag
        const metaTag = document.querySelector('meta[name="supabase-key"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        return '';
    }

    /**
     * Initialize cloud configuration
     */
    async initialize() {
        if (this.initialized) return;
        
        console.log(`[CloudConfig] Initialized for ${this.environment} environment`);
        console.log(`[CloudConfig] API Base: ${this.apiBase}`);
        console.log(`[CloudConfig] Supabase Configured: ${!!this.supabaseUrl}`);
        
        this.initialized = true;
        return this;
    }

    /**
     * Get configuration object for API calls
     */
    getApiConfig() {
        return {
            baseUrl: this.apiBase,
            environment: this.environment,
            timeout: this.environment === 'production' ? 10000 : 5000,
            retries: this.environment === 'production' ? 3 : 1
        };
    }

    /**
     * Get configuration object for Supabase
     */
    getSupabaseConfig() {
        return {
            url: this.supabaseUrl,
            key: this.supabaseKey
        };
    }

    /**
     * Validate cloud configuration
     */
    validate() {
        const errors = [];
        const warnings = [];
        
        if (!this.apiBase) {
            errors.push('API base URL not configured');
        }
        
        if (this.environment === 'production' && !this.supabaseUrl) {
            warnings.push('Supabase URL not configured - database features may not work');
        }
        
        if (this.environment === 'production' && !this.supabaseKey) {
            warnings.push('Supabase key not configured - authentication may fail');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get environment-specific configuration
     */
    getEnvironmentConfig() {
        const configs = {
            development: {
                debug: true,
                logRequests: true,
                cacheDuration: 300000, // 5 minutes
                syncInterval: 60000     // 1 minute
            },
            staging: {
                debug: false,
                logRequests: true,
                cacheDuration: 600000, // 10 minutes
                syncInterval: 120000    // 2 minutes
            },
            production: {
                debug: false,
                logRequests: false,
                cacheDuration: 900000, // 15 minutes
                syncInterval: 300000    // 5 minutes
            }
        };
        
        return configs[this.environment] || configs.production;
    }
}

// Create and export singleton instance
const cloudConfig = new CloudConfig();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cloudConfig.initialize());
} else {
    cloudConfig.initialize();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = cloudConfig;
}

// Also expose globally
window.cloudConfig = cloudConfig;
