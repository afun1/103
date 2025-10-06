// Add this endpoint to your existing server.js file

// API endpoint to get all videos for a specific user
app.get('/api/all-user-videos/:userEmail', async (req, res) => {
    try {
        const userEmail = decodeURIComponent(req.params.userEmail);
        console.log(`🎯 Getting ALL videos for user: ${userEmail}`);
        
        // Search Vimeo videos for user's recordings
        const searchResponse = await new Promise((resolve, reject) => {
            vimeo.request(
                {
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                    query: {
                        per_page: 100,
                        fields: 'name,description,created_time,link,uri,pictures.base_link'
                    }
                },
                (error, body, statusCode, headers) => {
                    if (error) {
                        console.error('❌ Vimeo API error:', error);
                        reject(error);
                    } else {
                        console.log(`✅ Found ${body.data?.length || 0} videos in folder`);
                        resolve(body);
                    }
                }
            );
        });
        
        // Filter for user's videos
        const userVideos = [];
        
        if (searchResponse.data) {
            searchResponse.data.forEach(video => {
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
        }
        
        // Sort by newest first
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ${userVideos.length} videos for ${userEmail}`);
        res.json(userVideos);
        
    } catch (error) {
        console.error('❌ Error fetching user recordings:', error);
        res.status(500).json({ 
            error: 'Failed to fetch recordings',
            message: error.message 
        });
    }
});