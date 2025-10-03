const { Vimeo } = require('@vimeo/vimeo');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const userEmail = req.query.email || 'john@tpnlife.com';
        console.log(`🎯 Getting recordings for user: ${userEmail}`);
        
        // For now, return test data to ensure the endpoint works
        const testRecordings = [
            {
                id: 'test_001',
                customerName: 'Test Customer 1',
                customerEmail: 'test1@example.com',
                recordedBy: 'John Bradshaw',
                recordedByEmail: 'john@tpnlife.com',
                recordingDate: new Date().toLocaleDateString(),
                description: 'Test recording - user-recordings endpoint working!',
                vimeoLink: 'https://vimeo.com/test',
                thumbnail: null,
                createdTime: new Date().toISOString()
            },
            {
                id: 'test_002',
                customerName: 'Test Customer 2', 
                customerEmail: 'test2@example.com',
                recordedBy: 'John Bradshaw',
                recordedByEmail: 'john@tpnlife.com',
                recordingDate: new Date(Date.now() - 86400000).toLocaleDateString(),
                description: 'Another test recording',
                vimeoLink: 'https://vimeo.com/test2',
                thumbnail: null,
                createdTime: new Date(Date.now() - 86400000).toISOString()
            }
        ];
        
        console.log(`✅ Returning ${testRecordings.length} test recordings for ${userEmail}`);
        res.json(testRecordings);
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch recordings',
            message: error.message 
        });
    }
};