// Get all videos for a specific user from Vimeo
export default async function handler(req, res) {
    console.log('📹 Fetching all user videos...');
    
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
        const { userEmail } = req.query;
        
        if (!vimeoToken) {
            console.error('❌ VIMEO_ACCESS_TOKEN not found');
            return res.status(500).json({
                success: false,
                error: 'Vimeo access token not configured'
            });
        }
        
        console.log(`👤 Fetching videos for user: ${userEmail}`);
        
        // Fetch all videos from Vimeo
        const response = await fetch(`https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,description,created_time,link,pictures`, {
            headers: {
                'Authorization': `Bearer ${vimeoToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📡 Vimeo API response: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Vimeo API error:', errorText);
            return res.status(response.status).json({
                success: false,
                error: `Vimeo API error: ${response.status}`,
                debug: errorText
            });
        }
        
        const data = await response.json();
        const allVideos = data.data || [];
        
        console.log(`📊 Total videos found: ${allVideos.length}`);
        
        // Filter videos for the specific user
        const userVideos = allVideos.filter(video => {
            if (!video.description) return false;
            
            const desc = video.description;
            const recordedByEmailMatch = desc.match(/Recorded By Email:\s*([^\s\n\r]+)/i);
            
            if (recordedByEmailMatch) {
                return recordedByEmailMatch[1].trim().toLowerCase() === userEmail.toLowerCase();
            }
            
            return false;
        }).map(video => {
            const desc = video.description || '';
            
            // Extract metadata from description
            const customerMatch = desc.match(/Customer:\s*([^\n\r]+)/i);
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\s\n\r]+)/i);
            const recordedByMatch = desc.match(/Recorded By:\s*([^\n\r]+)/i);
            const recordedByEmailMatch = desc.match(/Recorded By Email:\s*([^\s\n\r]+)/i);
            const recordingDateMatch = desc.match(/Recording Date:\s*([^\n\r]+)/i);
            
            // Get thumbnail
            let thumbnail = null;
            if (video.pictures && video.pictures.sizes) {
                const mediumPic = video.pictures.sizes.find(s => s.width >= 300) || video.pictures.sizes[0];
                thumbnail = mediumPic?.link;
            }
            
            return {
                vimeoLink: video.link,
                customerName: customerMatch ? customerMatch[1].trim() : video.name,
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : '',
                recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                description: desc,
                thumbnail,
                recordedBy: {
                    displayName: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                    email: recordedByEmailMatch ? recordedByEmailMatch[1].trim() : ''
                }
            };
        });
        
        console.log(`✅ Filtered ${userVideos.length} videos for user ${userEmail}`);
        
        return res.status(200).json(userVideos);
        
    } catch (error) {
        console.error('💥 User videos error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                errorType: error.constructor.name
            }
        });
    }
}