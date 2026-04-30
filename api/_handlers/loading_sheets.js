const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('loading_sheets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ success: true, loading_sheets: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { dc_number, date, items, total_nos, grand_total } = req.body;
            
            const { data, error } = await supabase
                .from('loading_sheets')
                .insert([{ dc_number, date, items, total_nos, grand_total }])
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, loading_sheet: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
};
