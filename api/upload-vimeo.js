const { Vimeo } = require('@vimeo/vimeo');
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { videoData, title, description, customerData, recordedBy } = req.body;
        
        if (!videoData || !title) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const vimeoAccessToken = process.env.VIMEO_ACCESS_TOKEN;
        if (!vimeoAccessToken) {
            return res.status(500).json({ error: 'Vimeo access token not configured' });
        }

        // Convert base64 to buffer
        const videoBuffer = Buffer.from(videoData, 'base64');

        // Create video on Vimeo
        const createResponse = await fetch('https://api.vimeo.com/me/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vimeoAccessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            },
            body: JSON.stringify({
                name: title,
                description: description,
                privacy: { view: 'unlisted' },
                folder_uri: '/folders/26555277'
            })
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('Vimeo create error:', errorText);
            return res.status(500).json({ error: 'Failed to create video on Vimeo' });
        }

        const videoInfo = await createResponse.json();
        const uploadLink = videoInfo.upload?.upload_link;
        
        if (!uploadLink) {
            return res.status(500).json({ error: 'No upload link received from Vimeo' });
        }

        // Upload video data
        const uploadResponse = await fetch(uploadLink, {
            method: 'PUT',
            body: videoBuffer,
            headers: {
                'Content-Type': 'video/webm'
            }
        });

        if (!uploadResponse.ok) {
            return res.status(500).json({ error: 'Failed to upload video to Vimeo' });
        }

        // Complete upload
        const completeResponse = await fetch(videoInfo.uri + '/upload', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${vimeoAccessToken}`,
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            }
        });

        return res.status(200).json({
            success: true,
            vimeoUri: videoInfo.uri,
            vimeoLink: videoInfo.link,
            message: 'Video uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}