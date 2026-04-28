const supabase = require('../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('delivery_challans')
                .select('*, companies(name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ success: true, delivery_challans: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { challan_number, company_id, date, items, status, notes } = req.body;
            if (!challan_number) return res.status(400).json({ success: false, error: 'Challan number is required.' });

            const { data, error } = await supabase
                .from('delivery_challans')
                .upsert([{ challan_number, company_id, date, items, status, notes }], { onConflict: 'challan_number' })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, delivery_challan: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
};
