// Get user recordings from Supabase with fallback to Vimeo parsing
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('📹 Fetching user recordings from Supabase...');
    
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
        const { userEmail } = req.query;
        
        if (!userEmail) {
            return res.status(400).json({
                success: false,
                error: 'User email is required'
            });
        }
        
        console.log(`👤 Fetching recordings for user: ${userEmail}`);
        
        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Supabase credentials missing, falling back to Vimeo parsing');
            return await fallbackToVimeoAPI(userEmail, res);
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Query recordings table for this user
        const { data: recordings, error } = await supabase
            .from('recordings')
            .select('*')
            .eq('recorded_by_email', userEmail)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Supabase query error:', error);
            // Fall back to Vimeo API parsing
            return await fallbackToVimeoAPI(userEmail, res);
        }
        
        console.log(`✅ Found ${recordings?.length || 0} recordings in Supabase for ${userEmail}`);
        
        // If no recordings in Supabase, try Vimeo fallback
        if (!recordings || recordings.length === 0) {
            console.log('🔄 No Supabase recordings found, trying Vimeo fallback...');
            return await fallbackToVimeoAPI(userEmail, res);
        }
        
        // Transform Supabase data to match expected format
        const transformedRecordings = recordings.map(recording => ({
            vimeoLink: recording.vimeo_url || '',
            customerName: recording.customer_name || 'Unknown',
            customerEmail: recording.customer_email || '',
            recordingDate: recording.created_at || recording.recording_date,
            description: recording.description || '',
            thumbnail: recording.thumbnail_url || null,
            recordedBy: {
                displayName: recording.recorded_by_name || 'Unknown',
                email: recording.recorded_by_email || userEmail
            }
        }));
        
        return res.status(200).json(transformedRecordings);
        
    } catch (error) {
        console.error('💥 User recordings error:', error);
        
        // Try Vimeo fallback on any error
        try {
            return await fallbackToVimeoAPI(req.query.userEmail, res);
        } catch (fallbackError) {
            console.error('💥 Fallback also failed:', fallbackError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user recordings',
                debug: {
                    mainError: error.message,
                    fallbackError: fallbackError.message
                }
            });
        }
    }
}

// Fallback function to parse Vimeo videos for user recordings
async function fallbackToVimeoAPI(userEmail, res) {
    console.log(`🔄 Using Vimeo API fallback for ${userEmail}`);
    
    const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
    
    if (!vimeoToken) {
        return res.status(500).json({
            success: false,
            error: 'No data source available (Supabase and Vimeo both unavailable)'
        });
    }
    
    // Fetch all videos from Vimeo
    const response = await fetch(`https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,description,created_time,link,pictures`, {
        headers: {
            'Authorization': `Bearer ${vimeoToken}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Vimeo API error: ${response.status}`);
    }
    
    const data = await response.json();
    const allVideos = data.data || [];
    
    console.log(`📊 Total Vimeo videos found: ${allVideos.length}`);
    
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
                email: recordedByEmailMatch ? recordedByEmailMatch[1].trim() : userEmail
            }
        };
    });
    
    console.log(`✅ Filtered ${userVideos.length} videos for user ${userEmail} from Vimeo`);
    
    return res.status(200).json(userVideos);
}