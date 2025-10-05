// Customers endpoint - extracts unique customers from Vimeo videos
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
        const vimeoAccessToken = process.env.VIMEO_ACCESS_TOKEN;
        if (!vimeoAccessToken) {
            return res.status(500).json({ error: 'Vimeo access token not configured' });
        }

        // Fetch all videos from the Vimeo folder using the correct endpoint
        const response = await fetch(`https://api.vimeo.com/users/112996063/projects/26555277/videos?per_page=100&sort=date&direction=desc`, {
            headers: {
                'Authorization': `Bearer ${vimeoAccessToken}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Vimeo customers error:', errorText);
            return res.status(500).json({ error: 'Failed to fetch videos from Vimeo' });
        }

        const data = await response.json();
        console.log(`📊 Total videos from Vimeo: ${data.data.length}`);
        
        // Extract unique customers from video descriptions
        const customersMap = new Map();
        
        data.data.forEach(video => {
            const desc = video.description || '';
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\n]+)/);
            
            if (customerEmailMatch) {
                const customerEmail = customerEmailMatch[1].trim();
                const customerName = video.name || 'Unknown Customer';
                
                // Use email as key to avoid duplicates
                if (!customersMap.has(customerEmail)) {
                    customersMap.set(customerEmail, {
                        name: customerName,
                        email: customerEmail,
                        id: customerEmail.replace(/[^a-zA-Z0-9]/g, '') // Create simple ID from email
                    });
                }
            }
        });
        
        const customers = Array.from(customersMap.values())
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        
        console.log(`✅ Found ${customers.length} unique customers`);
        
        res.json(customers);
        
    } catch (error) {
        console.error('❌ Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }
}