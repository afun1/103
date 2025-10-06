// Simple video assignment storage (in-memory)
const videoAssignments = new Map();

// Replace the complex move-video endpoint with this simple version
const simpleMoveEndpoint = (app) => {
    // Move video to user folder (assign video to user - appears in both folders)
    app.post('/api/move-video', async (req, res) => {
        try {
            console.log('🔄 Move video request received');
            console.log('📦 Request body:', req.body);
            
            const { videoId, videoUri, videoTitle, userId, userEmail, userName } = req.body;
            
            if (!videoUri || !userId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    message: 'videoUri and userId are required'
                });
            }
            
            console.log(`📹 Assigning video "${videoTitle}" (${videoUri}) to user ${userName} (${userId})`);
            
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
            
            console.log('✅ Video assignment stored successfully');
            console.log(`📁 Video "${videoTitle}" assigned to ${userName} - will appear in both main and personal folders`);
            
            res.json({
                success: true,
                message: `Video successfully assigned to ${userName}! It now appears in both the main folder and ${userName}'s personal folder.`,
                videoId: vimeoVideoId,
                assignedTo: {
                    userId,
                    userName,
                    userEmail
                },
                note: 'Video appears in both main and personal folders'
            });
            
        } catch (error) {
            console.error('❌ Error in move video endpoint:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    });

    // Get video assignments for user folders
    app.get('/api/video-assignments/:userId', (req, res) => {
        try {
            const { userId } = req.params;
            const userAssignments = Array.from(videoAssignments.values())
                .filter(assignment => assignment.userId === userId);
            
            console.log(`📋 Found ${userAssignments.length} video assignments for user ${userId}`);
            
            res.json({
                success: true,
                assignments: userAssignments
            });
        } catch (error) {
            console.error('❌ Error fetching video assignments:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    });
};

module.exports = { simpleMoveEndpoint, videoAssignments };