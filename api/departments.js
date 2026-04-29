const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (method === 'POST') {
            const dept = req.body;
            const { data, error } = await supabase
                .from('departments')
                .upsert([dept], { onConflict: 'id' })
                .select();

            if (error) throw error;
            return res.status(201).json(data[0]);
        }

        if (method === 'DELETE') {
            const { id } = req.query;
            const { error } = await supabase
                .from('departments')
                .delete()
                .match({ id });

            if (error) throw error;
            return res.status(200).json({ message: 'Deleted successfully' });
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        console.error('Departments API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
