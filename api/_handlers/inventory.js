const supabase = require('../../lib/supabase');

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (method === 'POST') {
            const item = req.body;
            const { data, error } = await supabase
                .from('inventory')
                .upsert([item], { onConflict: 'sku' }) // Assuming SKU is unique identifier like 'code' in frontend
                .select();

            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        if (method === 'DELETE') {
            const { id } = req.query;
            const { error } = await supabase
                .from('inventory')
                .delete()
                .match({ id });

            if (error) throw error;
            return res.status(200).json({ message: 'Deleted successfully' });
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        console.error('Inventory API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
