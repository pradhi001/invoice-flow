const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    // --- GET: List companies ---
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('name');

            if (error) throw error;
            return res.status(200).json({ success: true, companies: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- POST: Create company ---
    if (req.method === 'POST') {
        try {
            const { name, email, phone, address, avatar_color } = req.body;
            if (!name) return res.status(400).json({ success: false, error: 'Company name is required.' });

            const { data, error } = await supabase
                .from('companies')
                .insert([{ name, email, phone, address, avatar_color: avatar_color || '#0a3d6b' }])
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, company: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
};
