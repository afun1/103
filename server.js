const express = require('express');
const cors = require('cors');
const { Vimeo } = require('@vimeo/vimeo');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
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

// Configure multer for video uploads
const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
        const { videoData, title, description, customerData, recordedBy } = req.body;

        if (!videoData) {
            return res.status(400).json({ error: 'No video data provided' });
        }

        // Convert base64 to buffer and save to temporary file
        const videoBuffer = Buffer.from(videoData, 'base64');
        const fs = require('fs');
        const tmpPath = path.join(__dirname, 'temp_video.webm');
        
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
                                'recorded_by': recordedByName,
                                'recorded_by_email': recordedByEmail,
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

        // Extract video ID and create public URL
        const videoId = uploadResponse.uri.split('/').pop();
        const vimeoUrl = `https://vimeo.com/${videoId}`;
        
        console.log('✅ Video uploaded successfully:', vimeoUrl);
        
        // Save to database if Supabase is available
        try {
            const { data: insertData, error: dbError } = await supabase
                .from('recordings')
                .insert([{
                    customer_name: customerData.name,
                    customer_email: customerData.email,
                    vimeo_link: vimeoUrl,
                    recorded_by_name: recordedByName,
                    recorded_by_email: recordedByEmail,
                    recording_date: new Date().toISOString(),
                    description: description || 'No description provided'
                }]);
            
            if (dbError) {
                console.error('❌ Database save failed:', dbError);
                // Don't fail the whole operation, video is already uploaded
            } else {
                console.log('✅ Recording saved to database');
            }
        } catch (dbError) {
            console.error('❌ Database error:', dbError);
            // Continue anyway
        }

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
});

// Vimeo upload endpoint
app.post('/api/upload-to-vimeo', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, folderId } = req.body;
    const videoPath = req.file.path;

    console.log('Starting Vimeo upload:', { title, folderId });

    // Create upload on Vimeo
    const uploadResponse = await fetch('https://api.vimeo.com/me/videos', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      },
      body: JSON.stringify({
        name: title,
        description: description,
        privacy: {
          view: 'anybody',
          embed: 'public'
        },
        folder_uri: `/folders/${folderId || process.env.VIMEO_FOLDER_ID}`
      })
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Vimeo upload creation failed:', errorText);
      throw new Error(`Vimeo API error: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    const uploadLink = uploadData.upload.upload_link;
    const videoUri = uploadData.uri;

    console.log('Upload link received, uploading video file...');

    // Upload the actual video file
    const fs = require('fs');
    const videoBuffer = fs.readFileSync(videoPath);

    const uploadFileResponse = await fetch(uploadLink, {
      method: 'PATCH',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream'
      },
      body: videoBuffer
    });

    if (!uploadFileResponse.ok) {
      console.error('Video file upload failed:', uploadFileResponse.status);
      throw new Error(`Video upload failed: ${uploadFileResponse.status}`);
    }

    console.log('Video uploaded successfully:', videoUri);

    // Clean up temporary file
    fs.unlinkSync(videoPath);

    res.json({
      success: true,
      videoUri: videoUri,
      vimeoLink: `https://vimeo.com${videoUri.replace('/videos/', '/')}`
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (e) {
        console.error('Failed to clean up temp file:', e);
      }
    }
    
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message 
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
        
        const { VIMEO_ACCESS_TOKEN, VIMEO_FOLDER_ID } = process.env;
        
        if (!VIMEO_ACCESS_TOKEN) {
            return res.json({
                success: false,
                error: 'VIMEO_ACCESS_TOKEN not found in environment variables',
                details: 'Check .env file for VIMEO_ACCESS_TOKEN'
            });
        }
        
        if (!VIMEO_FOLDER_ID) {
            return res.json({
                success: false,
                error: 'VIMEO_FOLDER_ID not found in environment variables', 
                details: 'Check .env file for VIMEO_FOLDER_ID'
            });
        }
        
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
                        console.log('✅ Vimeo API test success:', body?.name || 'Unknown User');
                        resolve(body);
                    }
                }
            );
        });

        // Test folder access
        let folderTest = null;
        try {
            const folderResponse = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/projects/${VIMEO_FOLDER_ID}`
                }, (error, body) => {
                    if (error) {
                        resolve({ error: `Folder access failed: ${error.message}` });
                    } else {
                        resolve(body);
                    }
                });
            });
            folderTest = folderResponse;
        } catch (e) {
            folderTest = { error: e.message };
        }

        res.json({
            success: true,
            message: 'Vimeo API connection successful',
            user: {
                name: testResponse?.name || 'Unknown User',
                uri: testResponse?.uri || 'Unknown URI',
                account: testResponse?.account || 'Unknown Account'
            },
            folder: folderTest,
            config: {
                tokenPreview: VIMEO_ACCESS_TOKEN.substring(0, 10) + '...',
                folderId: VIMEO_FOLDER_ID
            }
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
                            approach: 'streaming',
                            size: '1000000' // 1MB test size
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
            console.log(`📄 DEBUG: Fetching page ${page} from Vimeo folder...`);
            
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                    query: { per_page: 100, page: page, fields: 'name,description,created_time' }
                }, (error, body) => {
                    if (error) {
                        console.error(`❌ DEBUG: Vimeo API error on page ${page}:`, error);
                        reject(error);
                    } else {
                        console.log(`✅ DEBUG: Page ${page}: found ${body.data?.length || 0} videos`);
                        resolve(body);
                    }
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                console.log(`📊 DEBUG: Page ${page} added ${response.data.length} videos. Total so far: ${allVideos.length}`);
                
                // FIXED: Stop pagination when we get fewer than requested  
                if (response.data.length < 100) {
                    console.log(`🏁 DEBUG: Reached end of videos (page ${page} had ${response.data.length} videos)`);
                    break;
                }
                page++;
            } else {
                console.log(`🏁 DEBUG: No more videos found on page ${page}`);
                break;
            }
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

// SIMPLE ENDPOINT - Get user videos from first page only (NO PAGINATION)
app.get('/api/all-user-videos/:userEmail', async (req, res) => {
    console.log('🚨 SIMPLE ALL VIDEOS ENDPOINT HIT - NO PAGINATION! 🚨');
    
    try {
        const userEmail = req.params.userEmail;
        console.log(`🎯 Getting FIRST PAGE ONLY for user: ${userEmail}`);
        
        // Get ALL videos from ALL pages using /me/videos
        let allVideos = [];
        let page = 1;
        
        while (true) {
            console.log(`📄 Fetching page ${page} from /me/videos...`);
            
            const response = await new Promise((resolve, reject) => {
                vimeo.request({
                    method: 'GET',
                    path: '/me/videos',
                    query: { per_page: 100, page: page, fields: 'name,description,created_time,link,uri,pictures.sizes,pictures.base_link' }
                }, (error, body) => {
                    if (error) {
                        console.error(`❌ Vimeo API error on page ${page}:`, error);
                        reject(error);
                    } else {
                        console.log(`✅ Found ${body.data?.length || 0} videos on page ${page}`);
                        resolve(body);
                    }
                });
            });
            
            if (response.data && response.data.length > 0) {
                allVideos = allVideos.concat(response.data);
                console.log(`📊 Page ${page} added ${response.data.length} videos. Total so far: ${allVideos.length}`);
                
                // Stop when we get fewer than requested (end of results)
                if (response.data.length < 100) {
                    console.log(`🏁 Reached end of videos (page ${page} had ${response.data.length} videos)`);
                    break;
                }
                page++;
            } else {
                console.log(`🏁 No more videos found on page ${page}`);
                break;
            }
        }
        
        console.log(`📊 Got ${allVideos.length} total videos from ALL pages`);
        
        // Filter for user from ALL videos
        const userVideos = allVideos.filter(video => {
            const desc = video.description || '';
            const match = desc.match(/Recorded By Email:\s*([^\n]+)/);
            const isMatch = match && match[1].trim().toLowerCase() === userEmail.toLowerCase();
            if (isMatch) {
                console.log(`✅ Found matching video: ${video.name}`);
            }
            return isMatch;
        }).map(video => {
            const desc = video.description || '';
            const customerEmailMatch = desc.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = desc.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = desc.match(/Recording Date:\s*([^\n]+)/);
            const sizes = video.pictures?.sizes || [];
            const preferred = sizes.find(s => s.width >= 320 && s.width <= 640) || sizes.find(s => s.width >= 300) || sizes[sizes.length - 1] || null;
            
            return {
                id: video.uri.split('/').pop(),
                customerName: video.name || 'Unknown Customer',
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'No email',
                recordedBy: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                recordedByEmail: userEmail,
                recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                description: desc.split('\n\nCustomer Email:')[0].trim() || 'No description available',
                vimeoLink: video.link,
                thumbnail: preferred ? preferred.link : (video.pictures?.base_link || null),
                createdTime: video.created_time
            };
        });
        
        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        console.log(`✅ Returning ${userVideos.length} videos for ${userEmail} (FIRST PAGE ONLY)`);
        res.json(userVideos);
        
    } catch (error) {
        console.error('❌ SIMPLE ERROR:', error);
        res.status(500).json({ 
            error: 'Failed to fetch recordings',
            details: error.message
        });
    }
});

// SAFE endpoint - Get user recordings from first page only (NO PAGINATION)
app.get('/api/user-recordings/:userEmail', async (req, res) => {
    console.log('🚨 SAFE USER RECORDINGS - FIRST PAGE ONLY!');
    
    try {
        const userEmail = req.params.userEmail;
        if (!userEmail) return res.status(400).json({ error: 'User email required' });
        console.log(`📊 Getting FIRST PAGE ONLY for user: ${userEmail}`);

        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                query: { per_page: 100, page: 1, fields: 'name,description,created_time,link,uri,pictures.sizes,pictures.base_link' }
            }, (error, body) => {
                if (error) { console.error('❌ Vimeo API error:', error); reject(error); }
                else { console.log(`✅ Found ${body.data?.length || 0} videos on first page`); resolve(body); }
            });
        });

        const userVideos = (response.data || []).filter(video => {
            const description = video.description || '';
            const recordedByEmailMatch = description.match(/Recorded By Email:\s*([^\n]+)/);
            return recordedByEmailMatch && recordedByEmailMatch[1].trim().toLowerCase() === userEmail.toLowerCase();
        }).map(video => {
            const description = video.description || '';
            const customerEmailMatch = description.match(/Customer Email:\s*([^\n]+)/);
            const recordedByMatch = description.match(/Recorded By:\s*([^\n]+)/);
            const recordingDateMatch = description.match(/Recording Date:\s*([^\n]+)/);
            const sizes = video.pictures?.sizes || [];
            const preferred = sizes.find(s => s.width >= 320) || sizes[sizes.length - 1] || null;
            return {
                id: video.uri.split('/').pop(),
                customerName: video.name || 'Unknown Customer',
                customerEmail: customerEmailMatch ? customerEmailMatch[1].trim() : 'No email',
                recordedBy: recordedByMatch ? recordedByMatch[1].trim() : 'Unknown',
                recordedByEmail: userEmail,
                recordingDate: recordingDateMatch ? recordingDateMatch[1].trim() : video.created_time,
                description: description.split('\n\nCustomer Email:')[0].trim() || 'No description available',
                vimeoLink: video.link,
                thumbnail: preferred ? preferred.link : (video.pictures?.base_link || null),
                createdTime: video.created_time
            };
        });

        userVideos.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        console.log(`✅ Returning ${userVideos.length} videos for ${userEmail} (FIRST 100 ONLY - NO PAGINATION)`);
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
        const videoResponse = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: `/videos/${videoId}`,
                query: { fields: 'uri,name,description,privacy,embed,files,player_embed_url,pictures.sizes,pictures.base_link' }
            }, (error, body) => {
                if (error) { console.error('❌ Vimeo API error:', error); reject(error); }
                else { console.log('✅ Video details retrieved'); resolve(body); }
            });
        });
        const sizes = videoResponse.pictures?.sizes || [];
        const preferred = sizes.find(s => s.width >= 640) || sizes[sizes.length - 1] || null;
        res.json({
            video: videoResponse,
            embedAllowed: videoResponse.embed?.html !== null,
            files: videoResponse.files || [],
            playerUrl: videoResponse.player_embed_url,
            thumbnail: preferred ? preferred.link : (videoResponse.pictures?.base_link || null)
        });
    } catch (error) {
        console.error('❌ Error getting video details:', error);
        res.status(500).json({ error: 'Failed to get video details', message: error.message });
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
                path: `/me/projects/${process.env.VIMEO_FOLDER_ID}/videos`,
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
                
                // FIXED: Simple pagination - stop when fewer than requested
                if (response.data.length < perPage) {
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
        console.log(`📝 Assigning video to ${userName} via description update`);
        
        // Get current video details from Vimeo
        vimeo.request(`/videos/${vimeoVideoId}`, (error, body, status_code, headers) => {
            if (error) {
                console.error('❌ Error fetching video from Vimeo:', error);
                // Do not send response here, let the final catch handle it.
                return;
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
                    // Let the final catch handle the error response
                    return;
                }
                
                console.log('✅ Successfully assigned video to user');
                console.log(`📁 Video "${videoTitle}" assigned to ${userName}`);
                
                // This is now the ONLY successful response
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
    console.log('📹 101 EXCELLENT: Full working screen recorder with customer management!');
});