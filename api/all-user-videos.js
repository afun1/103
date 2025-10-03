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
        const userEmail = req.query.userEmail || decodeURIComponent(req.url.split('/').pop());
        
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
        
        while (true) {
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
                    if (error) reject(error);
                    else resolve(body);
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                if (response.data.length < 100) break;
                page++;
            } else break;
        }
        
        console.log(`📊 Total videos from Vimeo: ${allVideos.length}`);
        
        // Filter for user's videos
        const userVideos = allVideos.filter(video => {
            const desc = video.description || '';
            const match = desc.match(/Recorded By Email:\s*([^\n]+)/);
            return match && match[1].trim().toLowerCase() === userEmail.toLowerCase();
        }).map(video => {
            const desc = video.description || '';
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = desc.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = desc.match(/Recording Date:\s*([^\n]+)/);
            
            return {
                id: video.uri.split('/').pop(),
                customerName: video.name || 'Unknown Customer',
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'No email',
                recordedBy: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                recordedByEmail: userEmail,
                recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                description: desc.split('\n\nCustomer Email:')[0].trim() || 'No description available',
                vimeoLink: video.link,
                thumbnail: video.pictures?.base_link || null,
                createdTime: video.created_time
            };
        });
        
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ${userVideos.length} videos for ${userEmail}`);
        res.json(userVideos);
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
}