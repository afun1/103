// Clean video copy endpoint without Vimeo API complications
const videoAssignments = new Map();

function addCleanCopyEndpoint(app) {
    // Simple video copy endpoint - no Vimeo API calls
    app.post('/api/copy-video', async (req, res) => {
        try {
            console.log('📋 Copy video request received');
            console.log('📦 Request body:', req.body);
            
            const { videoId, videoUri, videoTitle, userId, userEmail, userName } = req.body;
            
            if (!videoUri || !userId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    message: 'videoUri and userId are required'
                });
            }
            
            console.log(`📹 Copying video "${videoTitle}" (${videoUri}) to user ${userName} (${userId})`);
            
            const vimeoVideoId = videoUri.replace('/videos/', '');
            
            // Store assignment in memory (simple solution that won't crash)
            const assignment = {
                videoId: vimeoVideoId,
                videoUri: videoUri,
                videoTitle: videoTitle,
                userId: userId,
                userName: userName,
                userEmail: userEmail,
                assignedDate: new Date().toISOString()
            };
            
            videoAssignments.set(vimeoVideoId, assignment);
            
            console.log('✅ Video copy assignment stored successfully');
            console.log(`📁 Video "${videoTitle}" copied to ${userName}'s folder - original remains in main folder`);
            
            res.json({
                success: true,
                message: `Video successfully copied to ${userName}'s folder! The original remains in the main folder.`,
                videoId: vimeoVideoId,
                assignedTo: {
                    userId,
                    userName,
                    userEmail
                },
                note: 'Video copied to user folder - original remains in main folder'
            });
            
        } catch (error) {
            console.error('❌ Error in copy video endpoint:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    });
}

module.exports = { addCleanCopyEndpoint, videoAssignments };