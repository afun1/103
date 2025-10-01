// Fetch videos from specific Vimeo folder for customer extraction
module.exports = async function handler(req, res) {
    console.log('📹 Fetching folder videos...');
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
        const folderId = '26555277'; // Target folder ID
        
        if (!vimeoToken) {
            console.error('❌ VIMEO_ACCESS_TOKEN not found');
            return res.status(500).json({
                success: false,
                error: 'Vimeo access token not configured'
            });
        }
        
        console.log(`🔍 Fetching videos from folder ${folderId}...`);
        
        // Fetch videos from the specific folder
        const response = await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos?per_page=100&fields=uri,name,description,created_time,link`, {
            headers: {
                'Authorization': `Bearer ${vimeoToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📡 Vimeo folder API response: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Vimeo folder API error:', errorText);
            
            // If folder access fails, try getting all videos instead
            console.log('🔄 Trying fallback: fetching all user videos...');
            const fallbackResponse = await fetch(`https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,description,created_time,link`, {
                headers: {
                    'Authorization': `Bearer ${vimeoToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!fallbackResponse.ok) {
                const fallbackError = await fallbackResponse.text();
                return res.status(fallbackResponse.status).json({
                    success: false,
                    error: `Vimeo API error: ${fallbackResponse.status}`,
                    debug: { originalError: errorText, fallbackError }
                });
            }
            
            const fallbackData = await fallbackResponse.json();
            console.log(`✅ Fallback successful: ${fallbackData.data?.length || 0} videos found`);
            
            return res.status(200).json(fallbackData.data || []);
        }
        
        const data = await response.json();
        const videos = data.data || [];
        
        console.log(`✅ Successfully fetched ${videos.length} videos from folder`);
        
        // Extract customer info from video descriptions
        const customersMap = new Map();
        
        videos.forEach(video => {
            if (!video.description) return;
            
            const desc = video.description;
            const customerMatch = desc.match(/Customer:\s*([^\n\r]+)/i);
            const emailMatch = desc.match(/Customer Email:\s*([^\s\n\r]+)/i);
            
            if (customerMatch && emailMatch) {
                const name = customerMatch[1].trim();
                const email = emailMatch[1].trim();
                const key = email.toLowerCase();
                
                if (!customersMap.has(key)) {
                    const parts = name.split(/\s+/);
                    customersMap.set(key, {
                        name,
                        email,
                        firstName: parts[0] || '',
                        lastName: parts.slice(1).join(' ') || '',
                        customerName: name,
                        customerEmail: email
                    });
                }
            }
        });
        
        const customers = Array.from(customersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`👥 Extracted ${customers.length} unique customers`);
        
        return res.status(200).json(customers);
        
    } catch (error) {
        console.error('💥 Folder videos error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                errorType: error.constructor.name
            }
        });
    }
}