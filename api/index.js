const handlers = {
    ping: require('./_handlers/ping'),
    app_settings: require('./_handlers/app_settings'),
    companies: require('./_handlers/companies'),
    dashboard: require('./_handlers/dashboard'),
    delivery_challans: require('./_handlers/delivery_challans'),
    departments: require('./_handlers/departments'),
    inventory: require('./_handlers/inventory'),
    invoices: require('./_handlers/invoices'),
    loading_sheets: require('./_handlers/loading_sheets'),
    products: require('./_handlers/products'),
    purchase_orders: require('./_handlers/purchase_orders'),
    rdcs: require('./_handlers/rdcs'),
    team_members: require('./_handlers/team_members')
};

module.exports = async (req, res) => {
    // Extract the handler name from the URL
    // e.g., /api/purchase_orders -> purchase_orders
    const url = new URL(req.url, `http://${req.headers.host}`);
    const segments = url.pathname.split('/').filter(Boolean);
    
    // The first segment is 'api', the second is our handler name
    const handlerName = segments[1] || 'ping';

    try {
        const handler = handlers[handlerName];
        if (!handler) {
            return res.status(404).json({
                error: 'API Endpoint Not Found',
                endpoint: handlerName
            });
        }
        if (typeof handler !== 'function') {
            return res.status(500).json({ error: `Handler ${handlerName} is not a function` });
        }
        return await handler(req, res);
    } catch (error) {
        console.error(`Router error for ${handlerName}:`, error);
        return res.status(500).json({
            error: 'Router execution failed',
            endpoint: handlerName,
            details: error.message
        });
    }
};
