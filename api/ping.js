module.exports = (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'API is working',
        env: {
            SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
            SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing'
        }
    });
};
