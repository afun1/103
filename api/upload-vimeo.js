// Upload video to Vimeo with folder assignment
export default async function handler(req, res) {
    console.log('📤 Upload to Vimeo requested...');
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
        const { videoData, mimeType, title, description, folderId } = req.body;
        
        if (!vimeoToken) {
            console.error('❌ VIMEO_ACCESS_TOKEN not found');
            return res.status(500).json({
                success: false,
                error: 'Vimeo access token not configured'
            });
        }
        
        if (!videoData || !title) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: videoData and title'
            });
        }
        
        console.log(`🎬 Uploading video: ${title}`);
        
        // Convert base64 to buffer
        const videoBuffer = Buffer.from(videoData, 'base64');
        console.log(`📊 Video size: ${videoBuffer.length} bytes`);
        
        // Step 1: Create video on Vimeo
        const createResponse = await fetch('https://api.vimeo.com/me/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vimeoToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                upload: {
                    approach: 'post',
                    size: videoBuffer.length
                },
                name: title,
                description: description || ''
            })
        });
        
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ Vimeo create error:', errorText);
            return res.status(createResponse.status).json({
                success: false,
                error: `Vimeo create error: ${createResponse.status}`,
                debug: errorText
            });
        }
        
        const createData = await createResponse.json();
        const uploadUrl = createData.upload?.upload_link;
        const videoUri = createData.uri;
        
        if (!uploadUrl) {
            console.error('❌ No upload URL received from Vimeo');
            return res.status(500).json({
                success: false,
                error: 'No upload URL received from Vimeo'
            });
        }
        
        console.log(`⬆️ Uploading to: ${uploadUrl}`);
        
        // Step 2: Upload video data
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            body: videoBuffer,
            headers: {
                'Content-Type': mimeType || 'video/webm'
            }
        });
        
        if (!uploadResponse.ok) {
            console.error('❌ Upload failed:', uploadResponse.status);
            return res.status(uploadResponse.status).json({
                success: false,
                error: `Upload failed: ${uploadResponse.status}`
            });
        }
        
        console.log('✅ Upload successful, finalizing...');
        
        // Step 3: Finalize upload
        const finalizeResponse = await fetch(`https://api.vimeo.com${videoUri}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${vimeoToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: title,
                description: description || '',
                privacy: {
                    view: 'unlisted'
                }
            })
        });
        
        if (!finalizeResponse.ok) {
            const finalizeError = await finalizeResponse.text();
            console.error('❌ Finalize error:', finalizeError);
        }
        
        // Step 4: Add to folder if specified
        if (folderId) {
            console.log(`📁 Adding video to folder ${folderId}...`);
            try {
                const folderResponse = await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${vimeoToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uris: [videoUri]
                    })
                });
                
                if (folderResponse.ok) {
                    console.log('✅ Video added to folder successfully');
                } else {
                    console.warn('⚠️ Could not add to folder:', await folderResponse.text());
                }
            } catch (folderError) {
                console.warn('⚠️ Folder assignment error:', folderError);
            }
        }
        
        const vimeoUrl = `https://vimeo.com${videoUri.replace('/videos/', '/')}`;
        console.log(`🎉 Upload complete: ${vimeoUrl}`);
        
        return res.status(200).json({
            success: true,
            vimeoUrl,
            videoUri,
            message: 'Video uploaded successfully'
        });
        
    } catch (error) {
        console.error('💥 Upload error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                errorType: error.constructor.name
            }
        });
    }
}