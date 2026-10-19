const supabase = require('../lib/supabase');

/** Validate a Supabase access token before any service-role database request. */
async function authenticateRequest(req, res) {
    const authorization = req.headers.authorization || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        res.status(401).json({ error: 'Sign in to access Invoice Flow.' });
        return false;
    }

    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data?.user) {
        res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });
        return false;
    }

    req.authUser = data.user;
    return true;
}

module.exports = { authenticateRequest };

