// Test Vimeo API connection
export default async function handler(req, res) {
    console.log('🔍 Testing Vimeo API connection...');
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
        
        if (!vimeoToken) {
            console.error('❌ VIMEO_ACCESS_TOKEN not found in environment variables');
            return res.status(500).json({
                success: false,
                error: 'Vimeo access token not configured',
                debug: {
                    hasToken: false,
                    envKeys: Object.keys(process.env).filter(k => k.includes('VIMEO'))
                }
            });
        }
        
        console.log('✅ Vimeo token found, testing API call...');
        
        // Test basic API call to get user info
        const response = await fetch('https://api.vimeo.com/me', {
            headers: {
                'Authorization': `Bearer ${vimeoToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📡 Vimeo API response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Vimeo API error:', errorText);
            return res.status(response.status).json({
                success: false,
                error: `Vimeo API error: ${response.status}`,
                debug: {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                }
            });
        }
        
        const userData = await response.json();
        console.log('✅ Vimeo API connection successful');
        
        return res.status(200).json({
            success: true,
            message: 'Vimeo API connection working',
            debug: {
                userAccount: userData.name || 'Unknown',
                hasToken: true,
                tokenLength: vimeoToken.length
            }
        });
        
    } catch (error) {
        console.error('💥 Test error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                errorType: error.constructor.name,
                stack: error.stack
            }
        });
    }
}