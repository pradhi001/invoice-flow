const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    // --- GET: List products ---
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');

            if (error) throw error;
            return res.status(200).json({ success: true, products: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- POST: Create or Update product ---
    if (req.method === 'POST') {
        try {
            const { name, code, hsn, rate } = req.body;
            if (!name) return res.status(400).json({ success: false, error: 'Product name is required.' });

            const { data, error } = await supabase
                .from('products')
                .upsert([{ name, code, hsn, rate }], { onConflict: 'code' })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, product: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- DELETE: Delete product ---
    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ success: false, error: 'Product ID is required.' });

            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;

            return res.status(200).json({ success: true, message: 'Product deleted.' });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
};
