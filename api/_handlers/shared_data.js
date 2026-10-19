const supabase = require('../../lib/supabase');

const DATA_KEY = 'invoice_flow_shared_data';
const MAX_BYTES = 3 * 1024 * 1024;

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key,value,updated_at')
                .eq('key', DATA_KEY)
                .maybeSingle();
            if (error) throw error;
            return res.status(200).json({ value: data?.value ?? null, updated_at: data?.updated_at ?? null });
        }

        if (req.method === 'PUT') {
            const { value, expectedUpdatedAt } = req.body || {};
            if (!value || Array.isArray(value) || typeof value !== 'object') {
                return res.status(400).json({ error: 'Shared data must be an object.' });
            }
            if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_BYTES) {
                return res.status(413).json({ error: 'Shared data is too large to synchronize.' });
            }
            const allowedKeys = Object.keys(value);
            if (allowedKeys.length > 200 || allowedKeys.some(key =>
                !/^invoice_flow_[a-z0-9_]+$/i.test(key) ||
                /(?:session|current_user|team_members|user_companies|password|token)/i.test(key)
            )) {
                return res.status(400).json({ error: 'Shared data contains a private or unsupported key.' });
            }

            const { data: current, error: readError } = await supabase
                .from('app_settings')
                .select('key,updated_at')
                .eq('key', DATA_KEY)
                .maybeSingle();
            if (readError) throw readError;

            if ((current?.updated_at ?? null) !== (expectedUpdatedAt ?? null)) {
                return res.status(409).json({
                    error: 'Shared data changed on another device. Your local copy was preserved.',
                    updated_at: current?.updated_at ?? null
                });
            }

            const updatedAt = new Date().toISOString();
            let result;
            if (!current) {
                result = await supabase.from('app_settings')
                    .insert({ key: DATA_KEY, value, updated_at: updatedAt })
                    .select('value,updated_at').single();
            } else {
                result = await supabase.from('app_settings')
                    .update({ value, updated_at: updatedAt })
                    .eq('key', DATA_KEY)
                    .eq('updated_at', current.updated_at)
                    .select('value,updated_at').maybeSingle();
            }
            if (result.error) {
                if (result.error.code === '23505') {
                    return res.status(409).json({ error: 'Shared data changed on another device. Your local copy was preserved.' });
                }
                throw result.error;
            }
            if (!result.data) {
                return res.status(409).json({ error: 'Shared data changed on another device. Your local copy was preserved.' });
            }
            return res.status(200).json(result.data);
        }

        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
        console.error('Shared data API error:', error.message);
        return res.status(500).json({ error: 'Could not synchronize shared data.' });
    }
};

