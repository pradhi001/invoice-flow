const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('rdcs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ success: true, rdcs: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { rdc_number, company_id, dept, date, items, auto_delete_limit } = req.body;
            if (!rdc_number) return res.status(400).json({ success: false, error: 'RDC number is required.' });

            const { data, error } = await supabase
                .from('rdcs')
                .upsert([{ rdc_number, company_id, dept, date, items, auto_delete_limit }], { onConflict: 'rdc_number' })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, rdc: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
};
