// Fallback customers endpoint - extracts from Vimeo videos
export default async function handler(req, res) {
    console.log('👥 Fetching customers...');
    
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
        // This endpoint essentially does the same as folder-videos
        // but returns customers in a slightly different format for compatibility
        const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
        
        if (!vimeoToken) {
            return res.status(500).json({
                success: false,
                error: 'Vimeo access token not configured'
            });
        }
        
        // Fetch all videos to extract customer data
        const response = await fetch(`https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,description,created_time`, {
            headers: {
                'Authorization': `Bearer ${vimeoToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Vimeo API error:', errorText);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch customer data'
            });
        }
        
        const data = await response.json();
        const videos = data.data || [];
        
        // Extract unique customers from video descriptions
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
                        lastName: parts.slice(1).join(' ') || ''
                    });
                }
            }
        });
        
        const customers = Array.from(customersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`✅ Extracted ${customers.length} customers`);
        
        return res.status(200).json(customers);
        
    } catch (error) {
        console.error('💥 Customers error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}