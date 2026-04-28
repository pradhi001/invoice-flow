const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            const { key } = req.query;
            let query = supabase.from('app_settings').select('*');
            if (key) query = query.eq('key', key);

            const { data, error } = await query;
            if (error) throw error;
            
            if (key) return res.status(200).json(data[0] || { key, value: {} });
            return res.status(200).json(data);
        }

        if (method === 'POST') {
            const { key, value } = req.body;
            const { data, error } = await supabase
                .from('app_settings')
                .upsert([{ key, value, updated_at: new Date() }], { onConflict: 'key' })
                .select();

            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        console.error('App Settings API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
