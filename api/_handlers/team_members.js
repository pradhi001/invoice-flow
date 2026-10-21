module.exports = async (req, res) => {
    if (req.method === 'GET') {
        const user = req.authUser;
        if (!user) return res.status(401).json({ error: 'Sign in to access Invoice Flow.' });

        return res.status(200).json([{
            id: user.id,
            username: user.email || '',
            role: req.authRole || 'user',
            permissions: req.authPermissions || []
        }]);
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
        return res.status(403).json({ error: 'Manage account access in Supabase Auth.' });
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed.' });
};
