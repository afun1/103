const { Vimeo } = require('@vimeo/vimeo');

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

        if (!videoData) {
            return res.status(400).json({ error: 'No video data provided' });
        }

        // Initialize Vimeo client
        const vimeo = new Vimeo(
            process.env.VIMEO_CLIENT_ID,
            process.env.VIMEO_CLIENT_SECRET,
            process.env.VIMEO_ACCESS_TOKEN
        );

        // Convert base64 to buffer
        const videoBuffer = Buffer.from(videoData, 'base64');
        
        // For Vercel, we need to use streaming upload instead of temp files
        const recordedByName = recordedBy?.displayName || 'User';
        const recordedByEmail = recordedBy?.email || '';
        
        console.log('📊 Upload metadata:', {
            customerName: customerData.name,
            customerEmail: customerData.email,
            recordedByName,
            recordedByEmail,
            description: description?.substring(0, 50) + '...'
        });

        const structuredDescription = `${description}

Customer Email: ${customerData.email}
Recorded By: ${recordedByName}
Recorded By Email: ${recordedByEmail}
Recording Date: ${new Date().toLocaleString()}`;

        // Use Vimeo's streaming upload for Vercel
        const uploadResponse = await new Promise((resolve, reject) => {
            // First create the video entry
            vimeo.request(
                {
                    method: 'POST',
                    path: '/me/videos',
                    data: {
                        name: title,
                        description: structuredDescription,
                        folder_uri: `/me/folders/${process.env.VIMEO_FOLDER_ID}`,
                        privacy: {
                            view: 'anybody',
                            embed: 'public'
                        },
                        upload: {
                            approach: 'streaming',
                            size: videoBuffer.length.toString()
                        }
                    }
                },
                (error, body, statusCode, headers) => {
                    if (error) {
                        console.error('❌ Video creation error:', error);
                        reject(error);
                    } else {
                        console.log('✅ Video entry created:', body.uri);
                        
                        // Now upload the video data
                        const uploadLink = body.upload.upload_link;
                        
                        // Upload video buffer directly
                        fetch(uploadLink, {
                            method: 'PATCH',
                            headers: {
                                'Tus-Resumable': '1.0.0',
                                'Upload-Offset': '0',
                                'Content-Type': 'application/offset+octet-stream'
                            },
                            body: videoBuffer
                        })
                        .then(uploadRes => {
                            if (!uploadRes.ok) {
                                throw new Error(`Upload failed: ${uploadRes.status}`);
                            }
                            resolve({ uri: body.uri });
                        })
                        .catch(uploadError => {
                            console.error('❌ Upload error:', uploadError);
                            reject(uploadError);
                        });
                    }
                }
            );
        });

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
}