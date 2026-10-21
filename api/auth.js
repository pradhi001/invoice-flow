/** Verify a Supabase Auth token and require an administrator-approved app claim. */
async function authenticateRequest(req, res) {
    const authorization = req.headers.authorization || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        res.status(401).json({ error: 'Sign in to access Invoice Flow.' });
        return false;
    }

    let user;
    try {
        // Lazy loading keeps the health endpoint available when database config is invalid.
        const supabase = require('../lib/supabase');
        const { data, error } = await supabase.auth.getUser(match[1]);
        if (error || !data?.user) {
            res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });
            return false;
        }
        user = data.user;
    } catch (error) {
        console.error('Authentication service unavailable:', error.code || error.name || 'unknown');
        res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
        return false;
    }

    const appMetadata = user.app_metadata || {};
    if (appMetadata.invoice_flow_access !== true) {
        res.status(403).json({ error: 'This account is not authorized to use Invoice Flow.' });
        return false;
    }

    req.authUser = user;
    req.authRole = typeof appMetadata.role === 'string' ? appMetadata.role : 'user';
    req.authPermissions = Array.isArray(appMetadata.permissions) ? appMetadata.permissions : [];
    return true;
}

module.exports = { authenticateRequest };
