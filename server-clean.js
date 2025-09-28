const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Vimeo } = require('@vimeo/vimeo');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Increase payload limits for video uploads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static('public'));

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const vimeo = new Vimeo(process.env.VIMEO_CLIENT_ID, process.env.VIMEO_CLIENT_SECRET, process.env.VIMEO_ACCESS_TOKEN);

// Get videos from Vimeo folder 26555277
app.get('/api/folder-videos', async (req, res) => {
    try {
        const isRefresh = req.query.t ? ' (refresh request)' : '';
        console.log('Fetching videos from Vimeo folder 26555277...' + isRefresh);
        
        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: '/me/projects/26555277/videos',
                query: {
                    per_page: 100,
                    fields: 'uri,name,description,created_time,duration,pictures.sizes,link,user.name,user.email'
                }
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('Error fetching videos:', error);
                    reject(error);
                } else {
                    console.log(`Fetched ${body.data?.length || 0} videos`);
                    // Debug: log first video to see structure
                    if (body.data && body.data.length > 0) {
                        console.log('Sample video object:', JSON.stringify(body.data[0], null, 2));
                    }
                    resolve(body);
                }
            });
        });

        res.json({
            success: true,
            videos: response.data || [],
            total: response.data?.length || 0
        });

    } catch (error) {
        console.error('Error in folder-videos endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch videos',
            message: error.message
        });
    }
});

// Get users from Supabase profiles table
app.get('/api/users', async (req, res) => {
    try {
        console.log('Fetching users from Supabase...');
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, display_name, email, role')
            .order('role, display_name', { nullsFirst: false });

        console.log('Supabase query result:', { 
            userCount: users?.length || 0, 
            error, 
            sampleUser: users?.[0] 
        });

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log(`Fetched ${users?.length || 0} users`);

        res.json({
            success: true,
            users: users || [],
            total: users?.length || 0
        });

    } catch (error) {
        console.error('Error in users endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

// Simple in-memory storage for video assignments
let videoAssignments = {}; // { userId: [videoUri1, videoUri2, ...] }

// Assign video to user folder
app.post('/api/assign-video', (req, res) => {
    try {
        const { videoUri, userId } = req.body;
        
        if (!videoUri || !userId) {
            return res.status(400).json({ error: 'videoUri and userId are required' });
        }

        // Initialize user's video list if it doesn't exist
        if (!videoAssignments[userId]) {
            videoAssignments[userId] = [];
        }

        // Add video if not already assigned
        if (!videoAssignments[userId].includes(videoUri)) {
            videoAssignments[userId].push(videoUri);
        }

        res.json({ 
            success: true, 
            message: 'Video assigned successfully',
            userVideoCount: videoAssignments[userId].length
        });

    } catch (error) {
        console.error('Error assigning video:', error);
        res.status(500).json({ error: 'Failed to assign video' });
    }
});

// Get videos assigned to a user
app.get('/api/user-videos/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const assignedVideoUris = videoAssignments[userId] || [];
        
        res.json({
            success: true,
            videos: assignedVideoUris,
            count: assignedVideoUris.length
        });

    } catch (error) {
        console.error('Error fetching user videos:', error);
        res.status(500).json({ error: 'Failed to fetch user videos' });
    }
});

// Get all videos for a user by email (for "My Recordings" feature)
app.get('/api/all-user-videos/:email', async (req, res) => {
    try {
        const userEmail = decodeURIComponent(req.params.email);
        console.log(`🎬 Fetching all videos for user: ${userEmail}`);
        
        // Get all videos from the main folder
        const folderResponse = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: '/me/projects/26555277/videos',
                query: {
                    per_page: 100,
                    fields: 'uri,name,description,created_time,duration,pictures,player_embed_url'
                }
            }, (error, body, status_code) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ data: body.data, status_code });
                }
            });
        });

        if (!folderResponse.data) {
            console.log('❌ No videos found in main folder');
            return res.json([]);
        }

        const allVideos = folderResponse.data;
        console.log(`📚 Found ${allVideos.length} total videos in main folder`);
        
        // Filter videos that were recorded by this user
        const userVideos = allVideos.filter(video => {
            if (!video.description) return false;
            
            try {
                // Parse the video description to find "Recorded by Email"
                const lines = video.description.split('\n');
                for (const line of lines) {
                    if (line.startsWith('Recorded by Email:')) {
                        const recordedByEmail = line.replace('Recorded by Email:', '').trim();
                        return recordedByEmail.toLowerCase() === userEmail.toLowerCase();
                    }
                }
                return false;
            } catch (error) {
                console.error('Error parsing video description:', error);
                return false;
            }
        });

        console.log(`✅ Found ${userVideos.length} videos recorded by ${userEmail}`);
        res.json(userVideos);

    } catch (error) {
        console.error('❌ Error fetching user videos by email:', error);
        res.status(500).json({ error: 'Failed to fetch user videos', details: error.message });
    }
});

// Create a Vimeo folder for a user
app.post('/api/create-user-folder', async (req, res) => {
    try {
        const { userId, userName } = req.body;
        
        console.log(`Creating Vimeo folder for user: ${userName}`);
        
        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'POST',
                path: '/me/projects',
                query: {
                    name: `${userName} - Assigned Videos`,
                    description: `Videos assigned to ${userName}`
                }
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('Error creating user folder:', error);
                    reject(error);
                } else {
                    console.log('Created folder:', body);
                    resolve(body);
                }
            });
        });

        res.json({
            success: true,
            folder: response,
            folderId: response.uri.split('/').pop()
        });

    } catch (error) {
        console.error('Error creating user folder:', error);
        res.status(500).json({ error: 'Failed to create user folder' });
    }
});

// Copy video to user's Vimeo folder
app.post('/api/copy-video-to-user', async (req, res) => {
    try {
        const { videoUri, userFolderId } = req.body;
        
        console.log(`Copying video ${videoUri} to folder ${userFolderId}`);
        
        // Add video to the user's folder
        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'PUT',
                path: `/me/projects/${userFolderId}/videos${videoUri}`
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('Error copying video to folder:', error);
                    reject(error);
                } else {
                    console.log('Video copied successfully');
                    resolve(body);
                }
            });
        });

        res.json({
            success: true,
            message: 'Video copied to user folder'
        });

    } catch (error) {
        console.error('Error copying video:', error);
        res.status(500).json({ error: 'Failed to copy video to user folder' });
    }
});

// Get videos from a user's Vimeo folder
app.get('/api/user-folder-videos/:folderId', async (req, res) => {
    try {
        const { folderId } = req.params;
        
        console.log(`Fetching videos from user folder: ${folderId}`);
        
        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: `/me/projects/${folderId}/videos`,
                query: {
                    per_page: 100,
                    fields: 'uri,name,description,created_time,duration,pictures.sizes,link,user.name,user.email'
                }
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('Error fetching user folder videos:', error);
                    reject(error);
                } else {
                    console.log(`Fetched ${body.data?.length || 0} videos from user folder`);
                    resolve(body);
                }
            });
        });

        res.json({
            success: true,
            videos: response.data || [],
            total: response.data?.length || 0
        });

    } catch (error) {
        console.error('Error fetching user folder videos:', error);
        res.status(500).json({ error: 'Failed to fetch user folder videos' });
    }
});

// Get all user folders
app.get('/api/user-folders', async (req, res) => {
    try {
        console.log('Fetching all Vimeo folders...');
        
        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: '/me/projects',
                query: {
                    per_page: 100,
                    fields: 'uri,name,description,created_time,stats'
                }
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('Error fetching folders:', error);
                    reject(error);
                } else {
                    console.log(`Fetched ${body.data?.length || 0} folders`);
                    resolve(body);
                }
            });
        });

        res.json({
            success: true,
            folders: response.data || [],
            total: response.data?.length || 0
        });

    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// Get all customers from Supabase
app.get('/api/get-all-customers', async (req, res) => {
    try {
        console.log('📋 Fetching all customers from Supabase...');
        
        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .order('name');

        if (error) {
            console.error('❌ Error fetching customers:', error);
            return res.status(500).json({ error: 'Failed to fetch customers' });
        }

        console.log(`✅ Found ${customers?.length || 0} customers`);
        res.json({ customers: customers || [] });

    } catch (error) {
        console.error('❌ Server error fetching customers:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload video to Vimeo with proper chunked upload
app.post('/api/upload-vimeo', async (req, res) => {
    try {
        console.log('📤 Starting Vimeo upload process...');
        
        const { videoData, title, description, customerData, recordedBy } = req.body;
        
        if (!videoData || !title) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing video data or title' 
            });
        }

        // Extract customer and user info from objects
        const customerName = customerData?.name || 'Unknown Customer';
        const customerEmail = customerData?.email || 'unknown@example.com';
        const recordedByName = recordedBy?.displayName || 'Unknown User';
        const recordedByEmail = recordedBy?.email || 'unknown@example.com';

        // Convert base64 video data to buffer
        const videoBuffer = Buffer.from(videoData, 'base64');
        const fileSize = videoBuffer.length;
        
        console.log(`📊 Video size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Step 1: Create upload ticket
        console.log('🎫 Creating upload ticket...');
        const uploadTicket = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'POST',
                path: '/me/videos',
                query: {
                    upload: {
                        approach: 'tus',
                        size: fileSize
                    },
                    name: title,
                    description: buildVideoDescription(customerName, customerEmail, recordedByName, recordedByEmail, description)
                }
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('❌ Upload ticket error:', error);
                    reject(error);
                } else {
                    console.log('✅ Upload ticket created');
                    resolve(body);
                }
            });
        });

        const uploadLink = uploadTicket.upload.upload_link;
        const videoUri = uploadTicket.uri;

        // Step 2: Upload video in chunks
        console.log('📦 Starting chunked upload...');
        const chunkSize = 1024 * 1024 * 5; // 5MB chunks
        let offset = 0;

        while (offset < fileSize) {
            const chunk = videoBuffer.slice(offset, Math.min(offset + chunkSize, fileSize));
            const chunkEnd = offset + chunk.length - 1;
            
            console.log(`📤 Uploading chunk: ${offset}-${chunkEnd}/${fileSize}`);

            await new Promise((resolve, reject) => {
                const options = {
                    method: 'PATCH',
                    url: uploadLink,
                    headers: {
                        'Content-Type': 'application/offset+octet-stream',
                        'Upload-Offset': offset.toString(),
                        'Content-Length': chunk.length.toString(),
                        'Tus-Resumable': '1.0.0'
                    },
                    body: chunk
                };

                require('request')(options, (error, response) => {
                    if (error) {
                        console.error('❌ Chunk upload error:', error);
                        reject(error);
                    } else if (response.statusCode >= 400) {
                        console.error('❌ Chunk upload failed:', response.statusCode, response.body);
                        reject(new Error(`Upload failed: ${response.statusCode}`));
                    } else {
                        console.log(`✅ Chunk uploaded: ${offset}-${chunkEnd}`);
                        resolve();
                    }
                });
            });

            offset += chunk.length;
        }

        // Step 3: Complete upload
        console.log('🏁 Completing upload...');
        await new Promise((resolve, reject) => {
            const options = {
                method: 'HEAD',
                url: uploadLink,
                headers: {
                    'Accept': 'application/vnd.vimeo.*+json;version=3.4',
                    'Tus-Resumable': '1.0.0'
                }
            };

            require('request')(options, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    console.log('✅ Upload completed successfully');
                    resolve();
                }
            });
        });

        // Step 4: Move to target folder
        console.log('📁 Moving video to folder 26555277...');
        await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'PUT',
                path: `/me/projects/26555277${videoUri}`
            }, (error, body, statusCode) => {
                if (error) {
                    console.warn('⚠️ Could not move to folder:', error);
                    // Don't fail the whole upload for this
                    resolve();
                } else {
                    console.log('✅ Video moved to folder');
                    resolve();
                }
            });
        });

        res.json({
            success: true,
            message: 'Video uploaded successfully!',
            videoUri: videoUri,
            uploadLink: uploadLink
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Upload failed', 
            message: error.message 
        });
    }
});

// Helper function to build video description
function buildVideoDescription(customerName, customerEmail, recordedBy, recordedByEmail, additionalNotes) {
    let description = '';
    
    if (customerName) description += `Customer: ${customerName}\n`;
    if (customerEmail) description += `Customer Email: ${customerEmail}\n`;
    if (recordedBy) description += `Recorded by: ${recordedBy}\n`;
    if (recordedByEmail) description += `Recorded By Email: ${recordedByEmail}\n`;
    if (additionalNotes) description += `\n${additionalNotes}`;
    
    return description.trim();
}

// Update video metadata
app.put('/api/update-video', async (req, res) => {
    try {
        const { videoUri, title, description } = req.body;
        
        console.log(`Updating video ${videoUri} with title: ${title}`);
        console.log(`Description: ${description ? description.substring(0, 100) + '...' : 'No description'}`);
        
        const response = await new Promise((resolve, reject) => {
            const requestOptions = {
                method: 'PATCH',
                path: videoUri,
                query: {},
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            // Add body data for PATCH request
            if (title || description) {
                const updateData = {};
                if (title) updateData.name = title;
                if (description) updateData.description = description;
                requestOptions.body = JSON.stringify(updateData);
            }

            vimeo.request(requestOptions, (error, body, statusCode) => {
                console.log(`Vimeo API response status: ${statusCode}`);
                if (error) {
                    console.error('Vimeo API error:', error);
                    reject(error);
                } else if (statusCode >= 400) {
                    console.error('Vimeo API returned error status:', statusCode, body);
                    reject(new Error(`Vimeo API error: ${statusCode} - ${JSON.stringify(body)}`));
                } else {
                    console.log('Video updated successfully via Vimeo API');
                    resolve(body);
                }
            });
        });

        res.json({
            success: true,
            message: 'Video updated successfully',
            video: response
        });

    } catch (error) {
        console.error('Error updating video:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update video: ' + (error.message || error.toString())
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Clean rebuild - minimal endpoints only');
});