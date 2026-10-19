const supabase = require('../../lib/supabase');

module.exports = async (req, res) => {
    const { method } = req;

    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('team_members')
                .select('id,username,role,permissions,created_at,updated_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (method === 'POST' || method === 'DELETE') {
            return res.status(403).json({ error: 'Manage user accounts in Supabase Auth. Passwords are not stored in Invoice Flow.' });
        }

        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        console.error('Team Members API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

