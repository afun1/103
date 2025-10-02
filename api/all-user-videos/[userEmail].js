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
        // Extract email from URL path - handle both formats
        let userEmail = req.query.userEmail;
        
        if (!userEmail) {
            // Parse from URL path: /api/all-user-videos/john%40tpnlife.com
            const urlParts = req.url.split('/');
            const emailPart = urlParts[urlParts.length - 1];
            userEmail = decodeURIComponent(emailPart);
        }
        
        if (!userEmail || userEmail === 'all-user-videos') {
            return res.status(400).json({ error: 'User email required' });
        }
        
        console.log(`🎯 Getting ALL videos for user: ${userEmail}`);
        
        // Initialize Vimeo client
        const vimeo = new Vimeo(
            process.env.VIMEO_CLIENT_ID,
            process.env.VIMEO_CLIENT_SECRET,
            process.env.VIMEO_ACCESS_TOKEN
        );
        
        // Fetch ALL pages from Vimeo
        let allVideos = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            console.log(`📄 Fetching page ${page} of folder videos...`);
            
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
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
                
                // Check if there are more pages
                if (response.data.length < 100 || !response.paging?.next) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        
        console.log(`📊 Total videos from Vimeo: ${allVideos.length}`);
        
        // Filter for user's videos
        const userVideos = [];
        
        allVideos.forEach(video => {
            const description = video.description || '';
            const recordedByEmailMatch = description.match(/Recorded By Email:\s*([^\n]+)/);
            const customerEmailMatch = description.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = description.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = description.match(/Recording Date:\s*([^\n]+)/);
            
            if (recordedByEmailMatch && recordedByEmailMatch[1].trim().toLowerCase() === userEmail.toLowerCase()) {
                const mainDescription = description.split('\n\nCustomer Email:')[0].trim();
                
                userVideos.push({
                    id: video.uri.split('/').pop(),
                    customerName: video.name || 'Unknown Customer',
                    customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'No email',
                    recordedBy: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                    recordedByEmail: recordedByEmailMatch[1].trim(),
                    recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                    description: mainDescription || 'No description available',
                    vimeoLink: video.link,
                    thumbnail: video.pictures?.base_link || null,
                    createdTime: video.created_time
                });
            }
        });
        
        // Sort by newest first
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ALL ${userVideos.length} videos for ${userEmail} - NO LIMITS!`);
        
        // Return EVERYTHING - no pagination at all
        res.json(userVideos);
        
    } catch (error) {
        console.error('❌ Error fetching user recordings:', error);
        res.status(500).json({ 
            error: 'Failed to fetch recordings',
            message: error.message 
        });
    }
};