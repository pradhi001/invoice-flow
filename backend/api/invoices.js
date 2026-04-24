const supabase = require('../lib/supabase');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // --- GET: List invoices ---
    if (req.method === 'GET') {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            let query = supabase
                .from('invoices')
                .select('*, companies(name, initials, email, avatar_color)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            // Compute summary stats
            const { data: statsData, error: statsErr } = await supabase
                .from('invoices')
                .select('amount, paid_amount, status');

            if (statsErr) throw statsErr;

            const stats = {
                totalRevenue: statsData.reduce((sum, inv) => sum + Number(inv.paid_amount), 0),
                outstanding: statsData
                    .filter(i => i.status === 'overdue')
                    .reduce((sum, inv) => sum + (Number(inv.amount) - Number(inv.paid_amount)), 0),
                overdueCount: statsData.filter(i => i.status === 'overdue').length,
                pendingApproval: statsData.filter(i => i.status === 'pending').length
            };

            return res.status(200).json({
                success: true,
                invoices: data,
                total: count,
                page: Number(page),
                limit: Number(limit),
                stats
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- POST: Create invoice ---
    if (req.method === 'POST') {
        try {
            const { invoice_number, company_id, amount, due_date, notes, status } = req.body;

            if (!invoice_number || !amount) {
                return res.status(400).json({ success: false, error: 'invoice_number and amount are required.' });
            }

            const { data, error } = await supabase
                .from('invoices')
                .insert([{ invoice_number, company_id, amount, due_date, notes, status: status || 'pending' }])
                .select()
                .single();

            if (error) throw error;

            return res.status(201).json({ success: true, invoice: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- PUT: Update invoice ---
    if (req.method === 'PUT') {
        try {
            const { id, ...updates } = req.body;
            if (!id) return res.status(400).json({ success: false, error: 'Invoice ID is required.' });

            updates.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('invoices')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json({ success: true, invoice: data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- DELETE: Delete invoice ---
    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ success: false, error: 'Invoice ID is required.' });

            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;

            return res.status(200).json({ success: true, message: 'Invoice deleted.' });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
};
