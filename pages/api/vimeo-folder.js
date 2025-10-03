import { Vimeo } from '@vimeo/vimeo';

export default async function handler(req, res) {
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
        const folderId = req.query.folderId || process.env.VIMEO_FOLDER_ID || '26555277';
        console.log(`🎯 Getting all videos from Vimeo folder: ${folderId}`);
        
        // Initialize Vimeo client
        const vimeo = new Vimeo(
            process.env.VIMEO_CLIENT_ID,
            process.env.VIMEO_CLIENT_SECRET,
            process.env.VIMEO_ACCESS_TOKEN
        );
        
        // Fetch all videos from the folder
        let allVideos = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            console.log(`📄 Fetching page ${page} from folder ${folderId}...`);
            
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/folders/${folderId}/videos`,
                    query: { 
                        per_page: 100, 
                        page: page, 
                        fields: 'name,description,created_time,link,uri,pictures.base_link' 
                    }
                }, (error, body) => {
                    if (error) {
                        console.error(`❌ Error fetching page ${page}:`, error);
                        reject(error);
                    } else {
                        console.log(`✅ Page ${page}: found ${body.data?.length || 0} videos`);
                        resolve(body);
                    }
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                
                if (response.data.length < 100) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        
        console.log(`📊 Total videos from folder ${folderId}: ${allVideos.length}`);
        
        // Extract customer data from video descriptions and titles
        const customers = [];
        const customerMap = new Map();
        
        allVideos.forEach(video => {
            const description = video.description || '';
            const title = video.name || '';
            
            // Extract customer info from description format
            const emailMatch = description.match(/Customer Email:\s*([^\n]+)/);
            
            if (emailMatch && title) {
                const name = title.trim();
                const email = emailMatch[1].trim();
                const key = `${name}_${email}`;
                
                if (!customerMap.has(key)) {
                    customerMap.set(key, {
                        name,
                        email,
                        id: key,
                        videoCount: 1
                    });
                } else {
                    customerMap.get(key).videoCount++;
                }
            }
        });
        
        const uniqueCustomers = Array.from(customerMap.values());
        console.log(`✅ Returning ${uniqueCustomers.length} unique customers from folder`);
        
        res.json(uniqueCustomers);
        
    } catch (error) {
        console.error('❌ Error fetching folder videos:', error);
        res.status(500).json({ 
            error: 'Failed to fetch folder videos',
            message: error.message 
        });
    }
}