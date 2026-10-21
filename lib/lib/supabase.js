const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

function configurationError() {
    const error = new Error('Supabase server configuration is invalid.');
    error.code = 'SUPABASE_CONFIGURATION_ERROR';
    return error;
}

if (!rawUrl || !serviceKey) throw configurationError();

let parsedUrl;
try {
    parsedUrl = new URL(rawUrl);
} catch (_) {
    throw configurationError();
}

const localHttp = process.env.NODE_ENV !== 'production' && parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
if (!parsedUrl.hostname || (!localHttp && parsedUrl.protocol !== 'https:') || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash || (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '')) {
    throw configurationError();
}

module.exports = createClient(parsedUrl.origin, serviceKey);
