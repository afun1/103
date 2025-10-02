module.exports = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.json({
        vimeo_client_id: process.env.VIMEO_CLIENT_ID ? 'SET' : 'MISSING',
        vimeo_client_secret: process.env.VIMEO_CLIENT_SECRET ? 'SET' : 'MISSING', 
        vimeo_access_token: process.env.VIMEO_ACCESS_TOKEN ? 'SET' : 'MISSING',
        vimeo_folder_id: process.env.VIMEO_FOLDER_ID ? 'SET' : 'MISSING',
        vimeo_folder_id_value: process.env.VIMEO_FOLDER_ID,
        supabase_url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
        supabase_key: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING'
    });
};