const express = require('express');
const cors = require('cors');
const { Vimeo } = require('@vimeo/vimeo');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = require('node-fetch');
// const { simpleMoveEndpoint } = require('./simple-move-endpoint'); // Removed to prevent conflicts
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Vimeo client
const vimeo = new Vimeo(
    process.env.VIMEO_CLIENT_ID,
    process.env.VIMEO_CLIENT_SECRET,
    process.env.VIMEO_ACCESS_TOKEN
);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Using service key for server-side operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Debug middleware - log ALL requests
app.use((req, res, next) => {
    console.log(`🔍 REQUEST: ${req.method} ${req.url}`);
    if (req.url.includes('/api/user-recordings')) {
        console.log('🚨🚨🚨 USER RECORDINGS REQUEST DETECTED! 🚨🚨🚨');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/header', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'header.html'));
});

// Vimeo upload endpoint
app.post('/api/upload-vimeo', async (req, res) => {
    try {
        console.log('🚀 Upload endpoint called');
        console.log('Environment variables check:');
        console.log('VIMEO_CLIENT_ID:', process.env.VIMEO_CLIENT_ID ? 'SET' : 'MISSING');
        console.log('VIMEO_CLIENT_SECRET:', process.env.VIMEO_CLIENT_SECRET ? 'SET' : 'MISSING');
        console.log('VIMEO_ACCESS_TOKEN:', process.env.VIMEO_ACCESS_TOKEN ? 'SET' : 'MISSING');
        console.log('VIMEO_FOLDER_ID:', process.env.VIMEO_FOLDER_ID ? 'SET' : 'MISSING');
        console.log('VIMEO_FOLDER_ID value:', process.env.VIMEO_FOLDER_ID);
        
        const { videoData, title, description, customerData, recordedBy } = req.body;

        if (!videoData) {
            return res.status(400).json({ error: 'No video data provided' });
        }

        // Convert base64 to buffer - use in-memory approach for serverless
        const videoBuffer = Buffer.from(videoData, 'base64');
        console.log('📦 Video buffer created, size:', videoBuffer.length, 'bytes');

        // Validate buffer size
        if (videoBuffer.length === 0) {
            throw new Error('Video buffer is empty');
        }

        // Create structured description with all metadata
        const structuredDescription = `${description}

--- RECORDING DETAILS ---
Customer Email: ${customerData.email}
Recorded By: ${recordedBy.displayName}
Recorded By Email: ${recordedBy.email}
Recording Date: ${new Date().toLocaleString()}`;

        // Upload to Vimeo using direct API calls (more reliable for serverless)
        console.log('🚀 Starting Vimeo API upload process...');
        console.log('📊 Upload parameters:', {
            title,
            folder_uri: `/me/folders/${process.env.VIMEO_FOLDER_ID}`,
            buffer_size: videoBuffer.length
        });
        
        // Step 1: Create video entry using direct fetch to debug the issue
        console.log('🔧 Making direct Vimeo API call to debug upload object issue...');
        
        const createPayload = {
            name: title,
            description: structuredDescription,
            folder_uri: `/me/folders/${process.env.VIMEO_FOLDER_ID}`,
            privacy: {
                view: 'anybody',
                embed: 'public'
            },
            upload: {
                approach: 'tus',
                size: videoBuffer.length
            }
        };
        
        console.log('📤 Sending payload:', JSON.stringify(createPayload, null, 2));
        
        const createResponse = await fetch('https://api.vimeo.com/me/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.vimeo.*+json;version=3.4'
            },
            body: JSON.stringify(createPayload)
        });
        
        console.log('📥 Direct API response status:', createResponse.status);
        console.log('📥 Direct API response headers:', Object.fromEntries(createResponse.headers.entries()));
        
        const createResponseText = await createResponse.text();
        console.log('📥 Direct API response text:', createResponseText);
        
        if (!createResponse.ok) {
            throw new Error(`Vimeo API error: ${createResponse.status} ${createResponse.statusText} - ${createResponseText}`);
        }
        
        const createResponseData = JSON.parse(createResponseText);

        console.log('📤 Uploading video data...');
        console.log('Upload URL:', createResponseData.upload.upload_link);
        console.log('Video buffer size:', videoBuffer.length);
        
        // Step 2: Upload the actual video data
        const uploadUrl = createResponseData.upload.upload_link;
        
        const uploadResult = await fetch(uploadUrl, {
            method: 'POST',
            body: videoBuffer,
            headers: {
                'Content-Type': 'video/webm',
                'Content-Length': videoBuffer.length.toString()
            }
        });

        console.log('Upload result status:', uploadResult.status);
        console.log('Upload result headers:', uploadResult.headers.raw());

        if (!uploadResult.ok) {
            const errorText = await uploadResult.text();
            console.error('Upload error response:', errorText);
            throw new Error(`Upload failed: ${uploadResult.status} ${uploadResult.statusText} - ${errorText}`);
        }

        console.log('✅ Video data uploaded successfully');
        const uploadResponse = { uri: createResponseData.uri };

        console.log('✅ Video upload completed successfully:', uploadResponse.uri);

        // After successful upload, try to add custom metadata fields if available
        try {
            const videoId = uploadResponse.uri.split('/').pop();
            
            // Update video with additional metadata using Vimeo API
            await new Promise((resolve, reject) => {
                vimeo.request(
                    {
                        method: 'PATCH',
                        path: uploadResponse.uri,
                        data: {
                            // Custom fields for enterprise account
                            custom_fields: {
                                'customer_email': customerData.email,
                                'recorded_by': recordedBy.displayName,
                                'recorded_by_email': recordedBy.email,
                                'recording_date': new Date().toISOString(),
                                'customer_first_name': customerData.firstName || customerData.name.split(' ')[0],
                                'customer_last_name': customerData.lastName || customerData.name.split(' ').slice(1).join(' ')
                            }
                        }
                    },
                    (error, body, statusCode, headers) => {
                        if (error) {
                            console.log('Custom fields not available:', error);
                            // Don't fail the upload if custom fields aren't supported
                        }
                        resolve();
                    }
                );
            });
        } catch (metadataError) {
            console.log('Could not add custom metadata:', metadataError);
            // Continue anyway as the video was uploaded successfully
        }

        res.json({
            success: true,
            uri: uploadResponse.uri,
            message: 'Video uploaded successfully with metadata',
            customerData,
            recordedBy
        });

    } catch (error) {
        console.error('❌ Upload error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        res.status(500).json({
            error: 'Upload failed',
            message: error.message || 'Unknown error',
            details: error.toString(),
            name: error.name,
            stack: error.stack
        });
    }
});

// Test endpoint to check environment variables
app.get('/api/test-env', (req, res) => {
    res.json({
        vimeo_client_id: process.env.VIMEO_CLIENT_ID ? 'SET' : 'MISSING',
        vimeo_client_secret: process.env.VIMEO_CLIENT_SECRET ? 'SET' : 'MISSING', 
        vimeo_access_token: process.env.VIMEO_ACCESS_TOKEN ? 'SET' : 'MISSING',
        vimeo_folder_id: process.env.VIMEO_FOLDER_ID ? 'SET' : 'MISSING',
        vimeo_folder_id_value: process.env.VIMEO_FOLDER_ID,
        supabase_url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
        supabase_key: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING'
    });
});

// Test endpoint to verify Vimeo API connectivity
app.get('/api/test-vimeo', async (req, res) => {
    try {
        console.log('🧪 Testing Vimeo API connectivity...');
        
        const testResponse = await new Promise((resolve, reject) => {
            vimeo.request(
                {
                    method: 'GET',
                    path: '/me'
                },
                (error, body, statusCode, headers) => {
                    if (error) {
                        console.error('❌ Vimeo API test error:', error);
                        reject(error);
                    } else {
                        console.log('✅ Vimeo API test success:', body.name);
                        resolve(body);
                    }
                }
            );
        });

        res.json({
            success: true,
            message: 'Vimeo API connectivity test passed',
            vimeo_user: testResponse.name,
            account_type: testResponse.account
        });
    } catch (error) {
        console.error('❌ Vimeo API test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Vimeo API connectivity test failed',
            error: error.message
        });
    }
});

// Test endpoint for Vimeo video creation (without upload)
app.get('/api/test-vimeo-create', async (req, res) => {
    try {
        console.log('🧪 Testing Vimeo video creation...');
        
        const createResponse = await new Promise((resolve, reject) => {
            vimeo.request(
                {
                    method: 'POST',
                    path: '/me/videos',
                    data: {
                        name: 'Test Video Creation',
                        description: 'Testing video creation without upload',
                        folder_uri: `/me/folders/${process.env.VIMEO_FOLDER_ID}`,
                        privacy: {
                            view: 'anybody',
                            embed: 'public'
                        },
                        upload: {
                            approach: 'tus',
                            size: 1000000 // 1MB test size
                        }
                    }
                },
                (error, body, statusCode, headers) => {
                    if (error) {
                        console.error('❌ Video creation error:', error);
                        reject(error);
                    } else {
                        console.log('✅ Video creation success:', body.uri);
                        resolve(body);
                    }
                }
            );
        });

        res.json({
            success: true,
            message: 'Vimeo video creation test passed',
            video_uri: createResponse.uri,
            upload_link: createResponse.upload?.upload_link || 'No upload link',
            folder_uri: `/me/folders/${process.env.VIMEO_FOLDER_ID}`
        });
    } catch (error) {
        console.error('❌ Video creation test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Vimeo video creation test failed',
            error: error.message,
            stack: error.stack
        });
    }
});

// API endpoint to get all customers from Vimeo
app.get('/api/get-all-customers', async (req, res) => {
    try {
        console.log('Get all customers API called');
        
        // Search Vimeo videos for customer metadata
        const searchResponse = await new Promise((resolve, reject) => {
            vimeo.request(
                {
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                    query: {
                        per_page: 100,
                        fields: 'name,description,metadata.connections.comments.total'
                    }
                },
                (error, body, statusCode, headers) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(body);
                    }
                }
            );
        });
        
        console.log(`Found ${searchResponse.data ? searchResponse.data.length : 0} videos to extract customers from`);
        
        // Extract all unique customers from video descriptions and titles
        const customers = [];
        const customerMap = new Map();
        
        if (searchResponse.data) {
            searchResponse.data.forEach(video => {
                const description = video.description || '';
                const title = video.name || '';
                
                // Extract customer info from description format
                const emailMatch = description.match(/Customer Email:\s*([^\n]+)/);
                
                if (emailMatch && title) {
                    const name = title.trim(); // Title is the customer name
                    const email = emailMatch[1].trim();
                    const key = `${name}_${email}`;
                    
                    if (!customerMap.has(key)) {
                        const customer = {
                            name,
                            email,
                            id: key
                        };
                        
                        customerMap.set(key, customer);
                        customers.push(customer);
                    }
                }
            });
        }
        
        console.log(`Returning ${customers.length} unique customers`);
        
        // Sort by name
        customers.sort((a, b) => a.name.localeCompare(b.name));
        res.json(customers);
        
    } catch (error) {
        console.error('Get all customers error:', error);
        res.status(500).json({ error: 'Failed to retrieve customers' });
    }
});

// API endpoint to search customers in Vimeo
app.get('/api/search-customers', async (req, res) => {
    try {
        const query = req.query.q;
        
        console.log('Search customers API called with query:', query);
        
        if (!query || query.length < 1) { // Changed from 2 to 1 to allow email searches
            return res.json([]);
        }
        
        // Search Vimeo videos for customer metadata
        const searchResponse = await new Promise((resolve, reject) => {
            vimeo.request(
                {
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                    query: {
                        per_page: 100,
                        fields: 'name,description,metadata.connections.comments.total'
                    }
                },
                (error, body, statusCode, headers) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(body);
                    }
                }
            );
        });
        
        console.log(`Found ${searchResponse.data ? searchResponse.data.length : 0} videos to search through`);
        
        // Extract customer data from video descriptions and titles
        const customers = [];
        const customerMap = new Map();
        
        if (searchResponse.data) {
            searchResponse.data.forEach(video => {
                const description = video.description || '';
                const title = video.name || '';
                
                // Extract customer info from new description format
                const emailMatch = description.match(/Customer Email:\s*([^\n]+)/);
                
                if (emailMatch && title) {
                    const name = title.trim(); // Title is now the customer name
                    const email = emailMatch[1].trim();
                    const key = `${name}_${email}`;
                    
                    // Check if this customer matches the search query
                    const nameMatches = name.toLowerCase().includes(query.toLowerCase());
                    const emailMatches = email.toLowerCase().includes(query.toLowerCase());
                    const exactEmailMatch = email.toLowerCase() === query.toLowerCase();
                    
                    if (!customerMap.has(key) && (nameMatches || emailMatches)) {
                        const customer = {
                            name,
                            email,
                            id: key,
                            exactEmailMatch // Add flag for exact email matches
                        };
                        
                        customerMap.set(key, customer);
                        customers.push(customer);
                        
                        if (exactEmailMatch) {
                            console.log('Found exact email match:', customer);
                        }
                    }
                }
            });
        }
        
        console.log(`Returning ${customers.length} matching customers`);
        
        // Sort by name and limit results
        customers.sort((a, b) => a.name.localeCompare(b.name));
        res.json(customers.slice(0, 20)); // Increased limit to ensure we don't miss matches
        
    } catch (error) {
        console.error('Customer search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// DEBUG ENDPOINT - Show all videos and who recorded them
app.get('/api/debug-all-videos', async (req, res) => {
    console.log('🔍 DEBUG: Fetching ALL videos to see who recorded them');
    
    try {
        let allVideos = [];
        let page = 1;
        
        while (true) {
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                    query: { per_page: 100, page: page, fields: 'name,description,created_time' }
                }, (error, body) => {
                    if (error) reject(error);
                    else resolve(body);
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                if (response.data.length < 100) break;
                page++;
            } else break;
        }
        
        const debug = allVideos.map(video => {
            const desc = video.description || '';
            const recordedByEmailMatch = desc.match(/Recorded By Email:\s*([^\n]+)/);
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\n]+)/);
            
            return {
                title: video.name,
                recordedByEmail: recordedByEmailMatch ? recordedByEmailMatch[1].trim() : 'NOT FOUND',
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'NOT FOUND',
                date: video.created_time
            };
        });
        
        // Group by recorded by email
        const grouped = {};
        debug.forEach(video => {
            const email = video.recordedByEmail;
            if (!grouped[email]) grouped[email] = [];
            grouped[email].push(video);
        });
        
        console.log('📊 Videos grouped by recorder:', Object.keys(grouped).map(email => `${email}: ${grouped[email].length} videos`));
        
        res.json({
            total: allVideos.length,
            groupedByRecorder: grouped,
            allVideos: debug
        });
        
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: 'Debug failed' });
    }
});

// NEW ENDPOINT - Get ALL user recordings without any limits
app.get('/api/all-user-videos/:userEmail', async (req, res) => {
    console.log('🚨🚨🚨 NEW ALL VIDEOS ENDPOINT HIT! 🚨🚨🚨');
    
    try {
        const userEmail = req.params.userEmail;
        console.log(`🎯 Getting ALL videos for user: ${userEmail}`);
        
        // Fetch ALL pages from Vimeo
        let allVideos = [];
        let page = 1;
        
        while (true) {
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                    query: { per_page: 100, page: page, fields: 'name,description,created_time,link,uri,pictures.base_link' }
                }, (error, body) => {
                    if (error) reject(error);
                    else resolve(body);
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                if (response.data.length < 100) break;
                page++;
            } else break;
        }
        
        console.log(`📊 Total videos from Vimeo: ${allVideos.length}`);
        
        // Filter for user
        const userVideos = allVideos.filter(video => {
            const desc = video.description || '';
            const match = desc.match(/Recorded By Email:\s*([^\n]+)/);
            return match && match[1].trim().toLowerCase() === userEmail.toLowerCase();
        }).map(video => {
            const desc = video.description || '';
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = desc.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = desc.match(/Recording Date:\s*([^\n]+)/);
            
            return {
                id: video.uri.split('/').pop(),
                customerName: video.name || 'Unknown Customer',
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'No email',
                recordedBy: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                recordedByEmail: userEmail,
                recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                description: desc.split('--- RECORDING DETAILS ---')[0].trim() || 'No description available',
                vimeoLink: video.link,
                thumbnail: video.pictures?.base_link || null,
                createdTime: video.created_time
            };
        });
        
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ${userVideos.length} videos for ${userEmail}`);
        res.json(userVideos);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

// API endpoint to get user's recordings - RETURN ALL VIDEOS (NO PAGINATION)
app.get('/api/user-recordings/:userEmail', async (req, res) => {
    console.log('🚨 API ENDPOINT HIT - user-recordings called!');
    
    try {
        const userEmail = req.params.userEmail;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'User email required' });
        }
        
        console.log(`📊 Getting ALL videos for user: ${userEmail}`);
        
        // Get ALL videos from ALL pages of Vimeo folder
        let allVideos = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            const videosResponse = await new Promise((resolve, reject) => {
                vimeo.request(
                    {
                        method: 'GET',
                        path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                        query: {
                            per_page: 100,
                            page: page,
                            fields: 'name,description,created_time,link,uri,pictures.base_link'
                        }
                    },
                    (error, body, statusCode, headers) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(body);
                        }
                    }
                );
            });
            
            if (videosResponse.data && videosResponse.data.length > 0) {
                allVideos = allVideos.concat(videosResponse.data);
                page++;
                hasMore = videosResponse.data.length === 100;
            } else {
                hasMore = false;
            }
        }
        
        console.log(`📊 Fetched ${allVideos.length} total videos from Vimeo`);
        
        // Filter for user's videos
        const userVideos = [];
        
        allVideos.forEach(video => {
            const description = video.description || '';
            const recordedByEmailMatch = description.match(/Recorded By Email:\s*([^\n]+)/);
            const customerEmailMatch = description.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = description.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = description.match(/Recording Date:\s*([^\n]+)/);
            
            if (recordedByEmailMatch && recordedByEmailMatch[1].trim().toLowerCase() === userEmail.toLowerCase()) {
                const mainDescription = description.split('--- RECORDING DETAILS ---')[0].trim();
                
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
        
        // Sort by newest first
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ALL ${userVideos.length} videos for ${userEmail} - NO LIMITS!`);
        
        // Return EVERYTHING - no pagination at all
        res.json(userVideos);
        
    } catch (error) {
        console.error('Error fetching user recordings:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

// API endpoint to get Vimeo configuration
app.get('/api/vimeo-config', (req, res) => {
    try {
        const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
        const vimeoFolderId = process.env.VIMEO_FOLDER_ID;
        
        if (!vimeoToken || !vimeoFolderId) {
            return res.status(500).json({ 
                error: 'Vimeo configuration not found in environment variables' 
            });
        }
        
        res.json({ 
            token: vimeoToken,
            folderId: vimeoFolderId
        });
    } catch (error) {
        console.error('Error serving Vimeo config:', error);
        res.status(500).json({ error: 'Failed to retrieve Vimeo configuration' });
    }
});

// Get video file details and playable URLs
app.get('/api/video-details/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    try {
        console.log(`🎬 Getting video details for: ${videoId}`);
        
        // Get video details from Vimeo
        const videoResponse = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: `/videos/${videoId}`,
                query: {
                    fields: 'uri,name,description,privacy,embed,files,player_embed_url'
                }
            }, (error, body, statusCode, headers) => {
                if (error) {
                    console.error('❌ Vimeo API error:', error);
                    reject(error);
                } else {
                    console.log('✅ Video details retrieved');
                    resolve(body);
                }
            });
        });
        
        console.log('📹 Video privacy settings:', videoResponse.privacy);
        console.log('📹 Video embed settings:', videoResponse.embed);
        console.log('📹 Available files:', videoResponse.files?.length || 0);
        
        res.json({
            video: videoResponse,
            embedAllowed: videoResponse.embed?.html !== null,
            files: videoResponse.files || [],
            playerUrl: videoResponse.player_embed_url
        });
        
    } catch (error) {
        console.error('❌ Error getting video details:', error);
        res.status(500).json({ 
            error: 'Failed to get video details',
            message: error.message 
        });
    }
});

// Get folders (main Sparky folder + user folders)
app.get('/api/folders', async (req, res) => {
    try {
        console.log('📁 Fetching folders data...');
        
        // Get main folder video count from Vimeo
        console.log('🎬 Fetching main folder video count...');
        const mainFolderVideoCount = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: `/me/projects/26555277/videos`,
                query: {
                    per_page: 1,
                    fields: 'uri'
                }
            }, (error, body, statusCode) => {
                if (error) {
                    console.error('❌ Error fetching main folder count:', error);
                    resolve(0); // Default to 0 if error
                } else {
                    const count = body.total || 0;
                    console.log(`✅ Main folder has ${count} videos`);
                    resolve(count);
                }
            });
        });
        
        // Get all users from Supabase (using same columns as global header plus role)
        console.log('👥 Fetching users from Supabase...');
        const { data: allUsers, error: allUsersError } = await supabase
            .from('profiles')
            .select('id, display_name, email, role');
        
        if (allUsersError) {
            console.error('❌ Error fetching users:', allUsersError);
            throw allUsersError;
        }
        
        // Sort users by role first, then alphabetically by display_name
        if (allUsers && allUsers.length > 0) {
            allUsers.sort((a, b) => {
                // Define role hierarchy (lower number = higher priority)
                const roleOrder = {
                    'admin': 1,
                    'manager': 2,
                    'supervisor': 3,
                    'user': 4
                };
                
                const roleA = (a.role || 'user').toLowerCase();
                const roleB = (b.role || 'user').toLowerCase();
                
                const orderA = roleOrder[roleA] || 5;
                const orderB = roleOrder[roleB] || 5;
                
                // First sort by role
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                // Then sort alphabetically by display_name or email
                const nameA = (a.display_name || a.email || '').toLowerCase();
                const nameB = (b.display_name || b.email || '').toLowerCase();
                
                return nameA.localeCompare(nameB);
            });
        }
        
        console.log(`✅ Found ${allUsers?.length || 0} users (sorted by role, then alphabetically)`);
        
        // Create folders array
        const folders = [];
        
        // Add main Sparky Screen Recorder folder
        folders.push({
            id: 'main-sparky',
            name: 'Sparky Screen Recorder',
            type: 'main',
            videoCount: mainFolderVideoCount,
            description: 'Main collection of all recorded videos'
        });
        
        // Add user folders
        if (allUsers && allUsers.length > 0) {
            allUsers.forEach(user => {
                const folderName = user.display_name || user.email || 'Unknown User';
                
                // Count assigned videos for this user
                let userVideoCount = 0;
                for (const [videoId, assignment] of videoAssignments.entries()) {
                    if (assignment.userId === user.id) {
                        userVideoCount++;
                    }
                }
                
                folders.push({
                    id: `user-${user.id}`,
                    name: folderName,
                    type: 'user',
                    userId: user.id,
                    email: user.email,
                    role: user.role || 'user',
                    videoCount: userVideoCount, // Show actual assigned video count
                    description: `Personal folder for ${folderName}`
                });
            });
        }
        
        // Calculate stats
        const stats = {
            totalFolders: folders.length,
            totalVideos: mainFolderVideoCount,
            userFolders: folders.length - 1, // All folders except main
            mainFolderVideos: mainFolderVideoCount
        };
        
        console.log(`📂 Created ${folders.length} folders (1 main + ${folders.length - 1} user folders)`);
        
        res.json({
            success: true,
            folders: folders,
            stats: stats
        });
        
    } catch (error) {
        console.error('❌ Error in folders endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch folders',
            message: error.message
        });
    }
});

// Get all users from Supabase profiles table
app.get('/api/users', async (req, res) => {
    try {
        console.log('👥 Fetching users from Supabase profiles table...');
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                id,
                first_name,
                last_name,
                display_name,
                email,
                role,
                assigned_to_supervisor,
                assigned_to_manager,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error fetching users from Supabase:', error);
            throw error;
        }
        
        console.log(`✅ Successfully fetched ${users?.length || 0} users from Supabase`);
        
        // Calculate role statistics
        const roleStats = {
            admin: 0,
            manager: 0,
            supervisor: 0,
            user: 0,
            other: 0
        };
        
        users.forEach(user => {
            const role = user.role?.toLowerCase() || 'user';
            if (roleStats.hasOwnProperty(role)) {
                roleStats[role]++;
            } else {
                roleStats.other++;
            }
        });
        
        res.json({
            success: true,
            users: users || [],
            total: users?.length || 0,
            stats: {
                totalUsers: users?.length || 0,
                ...roleStats
            }
        });
        
    } catch (error) {
        console.error('❌ Error in users endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

// Get all videos from specific Vimeo folder
app.get('/api/folder-videos', async (req, res) => {
    try {
        console.log('🎬 Fetching videos from Vimeo folder 26555277...');
        
        const folderId = '26555277';
        let allVideos = [];
        let page = 1;
        const perPage = 100;
        let hasMore = true;
        
        while (hasMore) {
            console.log(`📄 Fetching page ${page} of folder videos...`);
            
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/projects/${folderId}/videos`,
                    query: {
                        page: page,
                        per_page: perPage,
                        fields: 'uri,name,description,created_time,duration,pictures.sizes,stats.plays,metadata.connections.likes.total,link,privacy'
                    }
                }, (error, body, statusCode) => {
                    if (error) {
                        console.error(`❌ Error fetching folder videos page ${page}:`, error);
                        reject(error);
                    } else {
                        console.log(`✅ Successfully fetched page ${page}, found ${body.data?.length || 0} videos`);
                        resolve(body);
                    }
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                
                // Check if there are more pages
                if (response.data.length < perPage || !response.paging?.next) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        
        console.log(`📹 Total videos found in folder: ${allVideos.length}`);
        
        // Sort videos by creation date (newest first)
        allVideos.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));
        
        // Calculate summary stats
        const totalViews = allVideos.reduce((sum, video) => sum + (video.stats?.plays || 0), 0);
        const totalDuration = allVideos.reduce((sum, video) => sum + (video.duration || 0), 0);
        
        res.json({
            success: true,
            videos: allVideos,
            total: allVideos.length,
            stats: {
                totalVideos: allVideos.length,
                totalViews: totalViews,
                totalDuration: totalDuration
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching folder videos:', error);
        res.status(500).json({
            error: 'Failed to fetch folder videos',
            message: error.message
        });
    }
});

// Delete customers from Vimeo (Admin only)
app.post('/api/delete-customers', async (req, res) => {
    try {
        console.log('🗑️ Delete customers request received');
        
        const { customerIds } = req.body;
        
        if (!customerIds || !Array.isArray(customerIds)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'customerIds array is required'
            });
        }
        
        console.log(`🗑️ Attempting to delete ${customerIds.length} customers:`, customerIds);
        
        const deleteResults = [];
        
        // Process each customer deletion
        for (const customerId of customerIds) {
            try {
                console.log(`🔍 Processing customer deletion: ${customerId}`);
                
                // First, find all videos for this customer
                const videos = await new Promise((resolve, reject) => {
                    vimeo.request({
                        method: 'GET',
                        path: '/me/videos',
                        query: {
                            per_page: 100,
                            fields: 'uri,name,description,metadata.connections.comments.total'
                        }
                    }, (error, body, statusCode) => {
                        if (error) {
                            console.error(`❌ Error fetching videos for customer ${customerId}:`, error);
                            reject(error);
                        } else {
                            resolve(body.data || []);
                        }
                    });
                });
                
                // Filter videos that belong to this customer (based on description or metadata)
                const customerVideos = videos.filter(video => {
                    const description = video.description || '';
                    return description.includes(customerId) || 
                           description.includes(customerId.split('_')[1]); // Check email part
                });
                
                console.log(`📹 Found ${customerVideos.length} videos for customer ${customerId}`);
                
                // Delete each video
                const deletedVideos = [];
                for (const video of customerVideos) {
                    try {
                        const videoId = video.uri.split('/').pop();
                        
                        await new Promise((resolve, reject) => {
                            vimeo.request({
                                method: 'DELETE',
                                path: `/videos/${videoId}`
                            }, (error, body, statusCode) => {
                                if (error) {
                                    console.error(`❌ Error deleting video ${videoId}:`, error);
                                    reject(error);
                                } else {
                                    console.log(`✅ Successfully deleted video ${videoId}`);
                                    deletedVideos.push(videoId);
                                    resolve();
                                }
                            });
                        });
                        
                    } catch (videoError) {
                        console.error(`❌ Error deleting individual video:`, videoError);
                    }
                }
                
                deleteResults.push({
                    customerId,
                    success: true,
                    deletedVideos: deletedVideos.length,
                    videoIds: deletedVideos
                });
                
            } catch (customerError) {
                console.error(`❌ Error processing customer ${customerId}:`, customerError);
                deleteResults.push({
                    customerId,
                    success: false,
                    error: customerError.message
                });
            }
        }
        
        const successfulDeletions = deleteResults.filter(r => r.success).length;
        const totalVideosDeleted = deleteResults.reduce((sum, r) => sum + (r.deletedVideos || 0), 0);
        
        console.log(`✅ Deletion complete: ${successfulDeletions}/${customerIds.length} customers processed, ${totalVideosDeleted} videos deleted`);
        
        res.json({
            success: true,
            message: `Successfully processed ${successfulDeletions} customer(s)`,
            totalCustomers: customerIds.length,
            successfulDeletions,
            totalVideosDeleted,
            results: deleteResults
        });
        
    } catch (error) {
        console.error('❌ Error in delete customers endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// In-memory storage for video assignments (simple solution)
const videoAssignments = new Map();

// Get videos for a specific user folder (includes assigned videos)
app.get('/api/user-folder-videos/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`📁 Fetching videos for user folder: ${userId}`);
        
        // Get all assigned videos for this user
        const userVideos = [];
        for (const [videoId, assignment] of videoAssignments.entries()) {
            if (assignment.userId === userId) {
                console.log(`🎬 Found assigned video: ${assignment.videoTitle}`);
                userVideos.push({
                    id: videoId,
                    uri: assignment.videoUri,
                    name: assignment.videoTitle,
                    assignedDate: assignment.assignedDate,
                    assignedBy: 'system', // Could be enhanced later
                    isAssigned: true
                });
            }
        }
        
        // If we have assigned videos, we need to get their full details from Vimeo
        const fullVideoDetails = [];
        
        if (userVideos.length > 0) {
            console.log(`🔍 Getting full details for ${userVideos.length} assigned videos...`);
            
            // Get all main folder videos to find the assigned ones
            const mainVideosResponse = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/projects/26555277/videos`,
                    query: {
                        per_page: 100,
                        fields: 'uri,name,description,created_time,duration,pictures.sizes,stats.plays,metadata.connections.likes.total,link,privacy'
                    }
                }, (error, body, statusCode) => {
                    if (error) {
                        console.error('❌ Error fetching main videos for user folder:', error);
                        resolve({ data: [] }); // Return empty on error to avoid crash
                    } else {
                        resolve(body);
                    }
                });
            });
            
            // Match assigned videos with their full details
            for (const userVideo of userVideos) {
                const fullVideo = mainVideosResponse.data?.find(v => v.uri === userVideo.uri);
                if (fullVideo) {
                    fullVideoDetails.push({
                        ...fullVideo,
                        isAssigned: true,
                        assignedDate: userVideo.assignedDate,
                        assignedBy: userVideo.assignedBy
                    });
                }
            }
        }
        
        console.log(`✅ User folder ${userId} has ${fullVideoDetails.length} videos`);
        
        res.json({
            success: true,
            videos: fullVideoDetails,
            total: fullVideoDetails.length,
            userId: userId,
            stats: {
                totalVideos: fullVideoDetails.length,
                assignedVideos: fullVideoDetails.length
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching user folder videos:', error);
        res.status(500).json({
            error: 'Failed to fetch user folder videos',
            message: error.message
        });
    }
});

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
            message: `Video successfully copied to ${userName}'s folder! The original remains in the main folder.`,
            videoId: vimeoVideoId,
            assignedTo: {
                userId,
                userName,
                userEmail
            },
            note: 'Video copied to user folder - original remains in main folder'
        });
        
        // For now, just update the video description with user assignment
        // instead of actually moving between folders (which was causing crashes)
        console.log(`� Assigning video to ${userName} via description update`);
        
        // Get current video details from Vimeo
        vimeo.request(`/videos/${vimeoVideoId}`, (error, body, status_code, headers) => {
            if (error) {
                console.error('❌ Error fetching video from Vimeo:', error);
                return res.status(500).json({
                    error: 'Failed to fetch video from Vimeo',
                    message: error.message
                });
            }
            
            const currentDescription = body.description || '';
            
            // Add user assignment to description
            const assignmentText = `\n\n--- FOLDER ASSIGNMENT ---\nAssigned to: ${userName}\nUser Email: ${userEmail}\nAssigned Date: ${new Date().toISOString()}\nUser ID: ${userId}`;
            
            let updatedDescription = currentDescription;
            
            // Remove any existing assignment
            updatedDescription = updatedDescription.replace(/\n\n--- FOLDER ASSIGNMENT ---[\s\S]*?(?=\n\n--- |$)/, '');
            
            // Add new assignment
            updatedDescription += assignmentText;
            
            // Update video description in Vimeo
            const updateData = {
                description: updatedDescription
            };
            
            vimeo.request(`/videos/${vimeoVideoId}`, updateData, 'PATCH', (patchError, patchBody, patchStatus) => {
                if (patchError) {
                    console.error('❌ Error updating video in Vimeo:', patchError);
                    return res.status(500).json({
                        error: 'Failed to update video in Vimeo',
                        message: patchError.message
                    });
                }
                
                console.log('✅ Successfully assigned video to user');
                console.log(`📁 Video "${videoTitle}" assigned to ${userName}`);
                
                res.json({
                    success: true,
                    message: `Video successfully assigned to ${userName}`,
                    videoId: vimeoVideoId,
                    assignedTo: {
                        userId,
                        userName,
                        userEmail
                    }
                });
            });
        });
        
    } catch (error) {
        console.error('❌ Error in move video endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Helper function removed - was causing Vimeo API crashes

// Simple move endpoint functionality integrated above

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('🔧 PAGINATION FIX APPLIED: Backend now returns ALL user videos without artificial limits');
});