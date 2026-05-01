const supabase = require('../../lib/supabase');

/**
 * Activity Logs Handler
 * Retrieves audit trail of all user actions
 */

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { user_id, company_id, table_name, limit = 50, offset = 0 } = req.query;

        if (!user_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'user_id parameter required' 
            });
        }

        // Verify current user exists and get their type
        const { data: currentUser, error: userError } = await supabase
            .from('team_members')
            .select('user_type, id')
            .eq('id', user_id)
            .single();

        if (userError || !currentUser) {
            return res.status(401).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Build query
        let query = supabase
            .from('activity_logs')
            .select(`
                id,
                user_id,
                table_name,
                record_id,
                action,
                old_data,
                new_data,
                company_id,
                timestamp,
                user:team_members(id, username),
                company:companies(id, name)
            `, { count: 'exact' })
            .order('timestamp', { ascending: false });

        // Filter by company if user is not admin
        if (currentUser.user_type !== 'admin' && company_id) {
            query = query.eq('company_id', company_id);
        } else if (company_id) {
            // Admin can filter by specific company
            query = query.eq('company_id', company_id);
        }

        // Filter by table if specified
        if (table_name) {
            query = query.eq('table_name', table_name);
        }

        // Pagination
        const numLimit = Math.min(parseInt(limit) || 50, 100); // Max 100
        const numOffset = Math.max(parseInt(offset) || 0, 0);
        query = query.range(numOffset, numOffset + numLimit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return res.status(200).json({
            success: true,
            activities: data || [],
            total: count || 0,
            limit: numLimit,
            offset: numOffset
        });

    } catch (error) {
        console.error('Activity Logs API Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};
