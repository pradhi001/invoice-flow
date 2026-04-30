const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { data, error } = await supabase.from('dashboard_stats').select('*').single();

        if (error) throw error;

        // Fetch recent transactions with company info
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('*, companies(name, initials, avatar_color)')
            .order('date', { ascending: false })
            .limit(5);

        if (txError) throw txError;

        return res.status(200).json({
            success: true,
            stats: data,
            recentTransactions: transactions
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
