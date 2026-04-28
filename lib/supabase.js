const { createClient } = require('@supabase/supabase-js');

// These are set in Vercel Environment Variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
