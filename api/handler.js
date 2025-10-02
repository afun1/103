module.exports = async (req, res) => {
    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { pathname } = new URL(req.url, `https://${req.headers.host}`);
    
    // Handle different API endpoints
    try {
        // Test environment variables endpoint
        if (pathname === '/api/test-env') {
            return res.json({
                vimeo_client_id: process.env.VIMEO_CLIENT_ID ? 'SET' : 'MISSING',
                vimeo_client_secret: process.env.VIMEO_CLIENT_SECRET ? 'SET' : 'MISSING', 
                vimeo_access_token: process.env.VIMEO_ACCESS_TOKEN ? 'SET' : 'MISSING',
                vimeo_folder_id: process.env.VIMEO_FOLDER_ID ? 'SET' : 'MISSING',
                vimeo_folder_id_value: process.env.VIMEO_FOLDER_ID,
                supabase_url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
                supabase_key: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING'
            });
        }

        // Customer search endpoint
        if (pathname === '/api/search-customers') {
            if (req.method !== 'GET') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const url = new URL(req.url, `https://${req.headers.host}`);
            const query = url.searchParams.get('q');
            
            if (!query || query.length < 1) {
                return res.json([]);
            }

            // For now, return mock data to avoid Vimeo API issues
            const mockCustomers = [
                { name: 'John Doe', email: 'john@example.com', id: 'john_doe_john@example.com' },
                { name: 'Jane Smith', email: 'jane@example.com', id: 'jane_smith_jane@example.com' }
            ].filter(customer => 
                customer.name.toLowerCase().includes(query.toLowerCase()) ||
                customer.email.toLowerCase().includes(query.toLowerCase())
            );

            return res.json(mockCustomers);
        }

        // Video upload endpoint - with real Vimeo integration
        if (pathname === '/api/upload-vimeo') {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const { videoData, title, description, customerData, recordedBy } = req.body;

            if (!videoData) {
                return res.status(400).json({ error: 'No video data provided' });
            }

            try {
                const { Vimeo } = require('@vimeo/vimeo');
                const fs = require('fs');
                const path = require('path');

                const vimeo = new Vimeo(
                    process.env.VIMEO_CLIENT_ID,
                    process.env.VIMEO_CLIENT_SECRET,
                    process.env.VIMEO_ACCESS_TOKEN
                );

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
                    recordedByEmail
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
                
                return res.json({
                    success: true,
                    uri: uploadResponse.uri,
                    vimeoUrl: vimeoUrl,
                    videoId: videoId,
                    message: 'Video uploaded successfully with metadata',
                    customerData,
                    recordedBy
                });

            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                return res.status(500).json({
                    error: 'Upload failed',
                    message: uploadError.message
                });
            }
        }

        // Default response for unknown endpoints
        return res.status(404).json({ 
            error: 'Endpoint not found',
            available: ['/api/test-env', '/api/search-customers', '/api/upload-vimeo']
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            endpoint: pathname
        });
    }
};