const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Upload video to Vimeo
router.post('/upload-vimeo', async (req, res) => {
    console.log('📤 Starting Vimeo video upload...');
    
    try {
        const { videoData, title, description, customerData, recordedBy } = req.body;
        
        if (!videoData || !title || !customerData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: videoData, title, or customerData'
            });
        }
        
        const { VIMEO_ACCESS_TOKEN, VIMEO_FOLDER_ID } = process.env;
        
        if (!VIMEO_ACCESS_TOKEN || !VIMEO_FOLDER_ID) {
            return res.status(500).json({
                success: false,
                error: 'Vimeo configuration missing - check VIMEO_ACCESS_TOKEN and VIMEO_FOLDER_ID'
            });
        }
        
        console.log('📊 Upload request:', {
            title,
            customer: customerData.name,
            descriptionLength: description?.length || 0,
            videoSizeKB: Math.round(Buffer.from(videoData, 'base64').length / 1024)
        });
        
        // Convert base64 to buffer
        const videoBuffer = Buffer.from(videoData, 'base64');
        console.log(`📹 Video buffer size: ${Math.round(videoBuffer.length / 1024 / 1024 * 100) / 100} MB`);
        
        // Step 1: Create video on Vimeo
        console.log('🎬 Step 1: Creating video entry on Vimeo...');
        const createResponse = await fetch('https://api.vimeo.com/me/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            },
            body: JSON.stringify({
                upload: {
                    approach: 'post',
                    size: videoBuffer.length
                },
                name: title,
                description: description || 'Screen recording',
                privacy: {
                    view: 'unlisted'
                }
            })
        });
        
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ Vimeo create video failed:', createResponse.status, errorText);
            return res.status(500).json({
                success: false,
                error: `Vimeo API error: ${createResponse.status} ${createResponse.statusText}`,
                details: errorText
            });
        }
        
        const createData = await createResponse.json();
        console.log('✅ Video created on Vimeo:', createData.uri);
        
        const uploadUrl = createData.upload.upload_link;
        const vimeoVideoId = createData.uri.split('/').pop();
        const vimeoUrl = `https://vimeo.com/${vimeoVideoId}`;
        
        // Step 2: Upload video content
        console.log('📤 Step 2: Uploading video content...');
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'video/webm'
            },
            body: videoBuffer
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Video upload failed:', uploadResponse.status, errorText);
            return res.status(500).json({
                success: false,
                error: `Video upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
                details: errorText
            });
        }
        
        console.log('✅ Video content uploaded successfully');
        
        // Step 3: Move video to folder (if folder ID is provided)
        if (VIMEO_FOLDER_ID && VIMEO_FOLDER_ID !== 'undefined') {
            console.log('📁 Step 3: Moving video to folder...');
            const folderResponse = await fetch(`https://api.vimeo.com/me/projects/${VIMEO_FOLDER_ID}/videos/${vimeoVideoId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (folderResponse.ok) {
                console.log('✅ Video moved to folder successfully');
            } else {
                console.warn('⚠️ Failed to move video to folder, but upload was successful');
            }
        }
        
        // Step 4: Save to database
        console.log('💾 Step 4: Saving to database...');
        try {
            const { data: insertData, error: dbError } = await supabase
                .from('recordings')
                .insert([{
                    customer_name: customerData.name,
                    customer_email: customerData.email,
                    vimeo_link: vimeoUrl,
                    recorded_by_name: recordedBy?.displayName || 'Unknown',
                    recorded_by_email: recordedBy?.email || 'unknown@example.com',
                    recording_date: new Date().toISOString(),
                    description: description || 'No description provided'
                }]);
            
            if (dbError) {
                console.error('❌ Database save failed:', dbError);
                // Don't fail the whole operation, video is already uploaded
                console.log('⚠️ Video uploaded to Vimeo but database save failed');
            } else {
                console.log('✅ Recording saved to database');
            }
        } catch (dbError) {
            console.error('❌ Database error:', dbError);
        }
        
        // Return success response
        res.json({
            success: true,
            message: 'Video uploaded successfully to Vimeo',
            vimeoUrl: vimeoUrl,
            videoId: vimeoVideoId,
            uploadDetails: {
                title,
                customer: customerData.name,
                sizeKB: Math.round(videoBuffer.length / 1024)
            }
        });
        
        console.log('🎉 Upload process completed successfully!');
        
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during upload',
            details: error.message
        });
    }
});

module.exports = router;