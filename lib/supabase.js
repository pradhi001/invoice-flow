const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Missing Supabase Environment Variables!');
    console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING');
    console.error('SUPABASE_SERVICE_KEY:', supabaseKey ? 'Set' : 'MISSING');
}

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);

module.exports = supabase;
