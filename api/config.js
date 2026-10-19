/**
 * Cloud Configuration Utilities
 * Handles environment variables and cloud-specific configurations
 */

/**
 * Get the correct API base URL for the environment
 * @returns {string} The API base URL
 */
function getApiBaseUrl() {
    // In production, use the environment variable
    if (process.env.NODE_ENV === 'production') {
        return process.env.VITE_API_BASE_URL || 'https://invoice-flow-pradhi.vercel.app';
    }
    
    // In development, check if we're in Vercel dev environment
    if (process.env.VERCEL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    
    // Default to localhost for local development
    return 'http://localhost:3000';
}

/**
 * Get Supabase configuration
 * @returns {object} Supabase configuration with url and key
 */
function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        console.warn('⚠️  Warning: Supabase environment variables not fully configured');
        console.warn('   SUPABASE_URL:', url ? '✓ Set' : '✗ Missing');
        console.warn('   SUPABASE_KEY:', key ? '✓ Set' : '✗ Missing');
    }
    
    return {
        url: url || 'https://placeholder.supabase.co',
        key: key || 'placeholder-key'
    };
}

/**
 * Validate all required environment variables for cloud deployment
 * @returns {object} Validation result with isValid boolean and errors array
 */
function validateCloudEnvironment() {
    const errors = [];
    const warnings = [];
    
    // Check critical variables
    if (!process.env.SUPABASE_URL) {
        errors.push('SUPABASE_URL environment variable is missing');
    }
    
    if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_ANON_KEY) {
        errors.push('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY environment variable is missing');
    }
    
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.VITE_API_BASE_URL) {
            warnings.push('VITE_API_BASE_URL not explicitly set for production');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        message: errors.length === 0 
            ? '✓ Cloud environment is properly configured' 
            : `✗ Cloud configuration errors: ${errors.join(', ')}`
    };
}

/**
 * Get CORS configuration for cloud deployment
 * @returns {object} CORS headers
 */
function getCorsHeaders(origin = '') {
    const allowedOrigins = new Set([
        'https://invoice-flow-sigma-plum.vercel.app',
        ...(process.env.APP_ORIGIN ? process.env.APP_ORIGIN.split(',').map(value => value.trim()) : []),
        ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
        ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [])
    ]);
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '3600',
        'Vary': 'Origin'
    };
    if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return headers;
}

/**
 * Get security headers for cloud deployment
 * @returns {object} Security headers
 */
function getSecurityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.vercel.app"
    };
}

module.exports = {
    getApiBaseUrl,
    getSupabaseConfig,
    validateCloudEnvironment,
    getCorsHeaders,
    getSecurityHeaders
};

