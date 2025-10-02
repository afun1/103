const { Vimeo } = require('@vimeo/vimeo');
const fs = require('fs');
const path = require('path');

// Initialize Vimeo client
const vimeo = new Vimeo(
    process.env.VIMEO_CLIENT_ID,
    process.env.VIMEO_CLIENT_SECRET,
    process.env.VIMEO_ACCESS_TOKEN
);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { videoData, title, description, customerData, recordedBy } = req.body;

        if (!videoData) {
            return res.status(400).json({ error: 'No video data provided' });
        }

        // Convert base64 to buffer and save to temporary file
        const videoBuffer = Buffer.from(videoData, 'base64');
        const tmpPath = path.join('/tmp', `temp_video_${Date.now()}.webm`);
        
        // Write buffer to temporary file
        fs.writeFileSync(tmpPath, videoBuffer);

        // Extract proper user information from recordedBy object
        const recordedByName = recordedBy?.displayName || 'John Bradshaw';
        const recordedByEmail = recordedBy?.email || 'john@tpnlife.com';
        
        console.log('📊 Upload metadata:', {
            customerName: customerData.name,
            customerEmail: customerData.email,
            recordedByName,
            recordedByEmail,
            description: description?.substring(0, 50) + '...'
        });

        // Create structured description with all metadata
        const structuredDescription = `${description}

Customer Email: ${customerData.email}
Recorded By: ${recordedByName}
Recorded By Email: ${recordedByEmail}
Recording Date: ${new Date().toLocaleString()}`;

        // Upload to Vimeo using file path
        const uploadResponse = await new Promise((resolve, reject) => {
            vimeo.upload(
                tmpPath,
                {
                    name: title,
                    description: structuredDescription,
                    folder_uri: `/me/folders/${process.env.VIMEO_FOLDER_ID}`,
                    privacy: {
                        view: 'anybody',
                        embed: 'public'
                    }
                },
                (uri) => {
                    console.log('Upload complete:', uri);
                    // Clean up temporary file
                    try {
                        fs.unlinkSync(tmpPath);
                    } catch (err) {
                        console.log('Could not delete temp file:', err);
                    }
                    resolve({ uri });
                },
                (bytesUploaded, bytesTotal) => {
                    const percentage = (bytesUploaded / bytesTotal * 100).toFixed(2);
                    console.log(`Upload progress: ${percentage}%`);
                },
                (error) => {
                    console.error('Upload error:', error);
                    // Clean up temporary file on error
                    try {
                        fs.unlinkSync(tmpPath);
                    } catch (err) {
                        console.log('Could not delete temp file:', err);
                    }
                    reject(error);
                }
            );
        });

        // Extract video ID and create public URL
        const videoId = uploadResponse.uri.split('/').pop();
        const vimeoUrl = `https://vimeo.com/${videoId}`;
        
        console.log('✅ Video uploaded successfully:', vimeoUrl);
        
        res.json({
            success: true,
            uri: uploadResponse.uri,
            vimeoUrl: vimeoUrl,
            videoId: videoId,
            message: 'Video uploaded successfully with metadata',
            customerData,
            recordedBy
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
};