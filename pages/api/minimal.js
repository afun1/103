module.exports = async (req, res) => {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // Parse URL safely
        let pathname;
        try {
            const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
            pathname = url.pathname;
        } catch (urlError) {
            pathname = req.url || '/';
        }

        console.log(`API Request: ${req.method} ${pathname}`);

        // Test environment endpoint
        if (pathname === '/api/test-env') {
            return res.status(200).json({
                status: 'working',
                vimeo_client_id: process.env.VIMEO_CLIENT_ID ? 'SET' : 'MISSING',
                vimeo_client_secret: process.env.VIMEO_CLIENT_SECRET ? 'SET' : 'MISSING',
                vimeo_access_token: process.env.VIMEO_ACCESS_TOKEN ? 'SET' : 'MISSING',
                vimeo_folder_id: process.env.VIMEO_FOLDER_ID ? 'SET' : 'MISSING',
                timestamp: new Date().toISOString()
            });
        }

        // Simple customer search - return mock data for now
        if (pathname === '/api/search-customers') {
            if (req.method !== 'GET') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            // Mock customer data to prevent crashes
            const mockCustomers = [
                { name: 'Test Customer 1', email: 'test1@example.com', id: 'test1' },
                { name: 'Test Customer 2', email: 'test2@example.com', id: 'test2' },
                { name: 'John Doe', email: 'john@example.com', id: 'john' }
            ];

            return res.status(200).json(mockCustomers);
        }

        // Upload endpoint - minimal response
        if (pathname === '/api/upload-vimeo') {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            // Simple success response without any complex processing
            return res.status(200).json({
                success: true,
                message: 'Upload endpoint is working! (Upload processing temporarily disabled)',
                timestamp: new Date().toISOString()
            });
        }

        // Default response
        return res.status(404).json({
            error: 'Endpoint not found',
            path: pathname,
            method: req.method,
            available: ['/api/test-env', '/api/search-customers', '/api/upload-vimeo']
        });

    } catch (error) {
        console.error('API Error:', error);
        
        // Absolutely minimal error response
        try {
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'Unknown error',
                timestamp: new Date().toISOString()
            });
        } catch (responseError) {
            // Last resort - plain text response
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }
};