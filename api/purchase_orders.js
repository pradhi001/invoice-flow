const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (method === 'POST') {
            const body = req.body;
            // Clean up body for DB (remove local IDs if they exist)
            const poData = {
                no: body.no,
                date: body.date,
                vendor: body.vendor,
                items: body.items,
                status: body.status || 'Active'
            };

            const { data, error } = await supabase
                .from('purchase_orders')
                .upsert([poData], { onConflict: 'no' })
                .select();

            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        if (method === 'DELETE') {
            const { id } = req.query;
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .match({ id });

            if (error) throw error;
            return res.status(200).json({ message: 'Deleted successfully' });
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        console.error('Purchase Orders API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
