const { Vimeo } = require('@vimeo/vimeo');

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userEmail } = req.query;
        console.log('🚨 VERCEL: ALL VIDEOS ENDPOINT - FULL PAGINATION! 🚨');
        console.log(`🎯 Getting ALL videos for user: ${userEmail}`);
        
        // Initialize Vimeo client
        const vimeo = new Vimeo(
            process.env.VIMEO_CLIENT_ID,
            process.env.VIMEO_CLIENT_SECRET,
            process.env.VIMEO_ACCESS_TOKEN
        );
        
        // Get ALL videos from ALL pages using /me/videos
        let allVideos = [];
        let page = 1;
        
        while (true) {
            console.log(`📄 Fetching page ${page} from /me/videos...`);
            
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: '/me/videos',
                    query: { 
                        per_page: 100, 
                        page: page, 
                        fields: 'name,description,created_time,link,uri,pictures.sizes,pictures.base_link' 
                    }
                }, (error, body) => {
                    if (error) {
                        console.error(`❌ Vimeo API error on page ${page}:`, error);
                        reject(error);
                    } else {
                        console.log(`✅ Found ${body.data?.length || 0} videos on page ${page}`);
                        resolve(body);
                    }
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                console.log(`📊 Page ${page} added ${response.data.length} videos. Total so far: ${allVideos.length}`);
                
                // Stop when we get fewer than requested (end of results)
                if (response.data.length < 100) {
                    console.log(`🏁 Reached end of videos (page ${page} had ${response.data.length} videos)`);
                    break;
                }
                page++;
            } else {
                console.log(`🏁 No more videos found on page ${page}`);
                break;
            }
        }
        
        console.log(`📊 Got ${allVideos.length} total videos from ALL pages`);
        
        // Filter for user from ALL videos
        const userVideos = allVideos.filter(video => {
            const desc = video.description || '';
            const match = desc.match(/Recorded By Email:\s*([^\n]+)/);
            const isMatch = match && match[1].trim().toLowerCase() === userEmail.toLowerCase();
            if (isMatch) {
                console.log(`✅ Found matching video: ${video.name}`);
            }
            return isMatch;
        }).map(video => {
            const desc = video.description || '';
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = desc.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = desc.match(/Recording Date:\s*([^\n]+)/);
            const sizes = video.pictures?.sizes || [];
            const preferred = sizes.find(s => s.width >= 320 && s.width <= 640) || 
                            sizes.find(s => s.width >= 300) || 
                            sizes[sizes.length - 1] || null;
            
            return {
                id: video.uri.split('/').pop(),
                customerName: video.name || 'Unknown Customer',
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'No email',
                recordedBy: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                recordedByEmail: userEmail,
                recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                description: desc.split('\n\nCustomer Email:')[0].trim() || 'No description available',
                vimeoLink: video.link,
                thumbnail: preferred ? preferred.link : (video.pictures?.base_link || null),
                createdTime: video.created_time
            };
        });
        
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ${userVideos.length} videos for ${userEmail} (ALL VIDEOS WITH THUMBNAILS)`);
        res.json(userVideos);
        
    } catch (error) {
        console.error('❌ VERCEL ERROR:', error);
        res.status(500).json({ 
            error: 'Failed to fetch recordings',
            details: error.message
        });
    }
}