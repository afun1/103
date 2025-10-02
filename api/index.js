const express = require('express');
const cors = require('cors');
const { Vimeo } = require('@vimeo/vimeo');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Initialize Vimeo client
const vimeo = new Vimeo(
    process.env.VIMEO_CLIENT_ID,
    process.env.VIMEO_CLIENT_SECRET,
    process.env.VIMEO_ACCESS_TOKEN
);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for video uploads (use /tmp for serverless)
const upload = multer({
  dest: '/tmp/',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Debug middleware
app.use((req, res, next) => {
    console.log(`🔍 REQUEST: ${req.method} ${req.url}`);
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'signup.html'));
});

app.get('/header', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'header.html'));
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
        const tmpPath = path.join('/tmp', 'temp_video.webm');
        
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

// API endpoint to search customers in Vimeo
app.get('/api/search-customers', async (req, res) => {
    try {
        const query = req.query.q;
        
        console.log('Search customers API called with query:', query);
        
        if (!query || query.length < 1) {
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
                    const name = title.trim();
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
                            exactEmailMatch
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
        res.json(customers.slice(0, 20));
        
    } catch (error) {
        console.error('Customer search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Export for Vercel
module.exports = app;

const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  try {
    const filePath = path.join(__dirname, '../public/index.html');
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error serving index:', error);
    res.status(500).json({ error: 'Failed to load page' });
  }
};