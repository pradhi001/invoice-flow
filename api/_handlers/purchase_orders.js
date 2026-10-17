const supabase = require('../../lib/supabase');

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
            const poData = {
                no: body.no,
                date: body.date,
                vendor: body.vendor,
                departments: body.departments || [],
                items: body.items,
                status: body.status || 'Active'
            };

            const { data, error } = await supabase
                .from('purchase_orders')
                .insert([poData])
                .select();

            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        if (method === 'PUT') {
            const body = req.body || {};
            if (!body.id) {
                return res.status(400).json({ error: 'PO id is required for update' });
            }

            const poData = {
                no: body.no,
                date: body.date,
                vendor: body.vendor,
                items: body.items,
                status: body.status || 'Active'
            };

            const { data, error } = await supabase
                .from('purchase_orders')
                .update(poData)
                .eq('id', body.id)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'Purchase order not found' });
            }
            return res.status(200).json(data[0]);
        }

        if (method === 'DELETE') {
            const id = req.query?.id || req.body?.id;
            if (!id) {
                return res.status(400).json({ error: 'PO id is required for delete' });
            }
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .match({ id });

            if (error) throw error;
            return res.status(200).json({ message: 'Deleted successfully' });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        console.error('Purchase Orders API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
