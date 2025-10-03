const express = require('express');
const cors = require('cors');
const { Vimeo } = require('@vimeo/vimeo');
const { createClient } = require('@supabase/supabase-js');
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
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Basic routes
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/public/login.html'));
app.get('/signup', (req, res) => res.sendFile(__dirname + '/public/signup.html'));

// SIMPLE test endpoint
app.get('/api/test-vimeo', async (req, res) => {
    try {
        if (!process.env.VIMEO_ACCESS_TOKEN) {
            return res.json({ success: false, error: 'No Vimeo token' });
        }
        
        const testResponse = await new Promise((resolve, reject) => {
            vimeo.request({ method: 'GET', path: '/me' }, (error, body) => {
                if (error) reject(error);
                else resolve(body);
            });
        });

        res.json({
            success: true,
            message: 'Vimeo works',
            user: testResponse?.name || 'Unknown'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// SIMPLE user videos - FIRST PAGE ONLY
app.get('/api/user-videos/:userEmail', async (req, res) => {
    try {
        const userEmail = req.params.userEmail;
        
        const response = await new Promise((resolve, reject) => {
            vimeo.request({
                method: 'GET',
                path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                query: { per_page: 50, fields: 'name,description,created_time,link,uri' }
            }, (error, body) => {
                if (error) reject(error);
                else resolve(body);
            });
        });

        const userVideos = (response.data || [])
            .filter(video => {
                const desc = video.description || '';
                const match = desc.match(/Recorded By Email:\s*([^\n]+)/);
                return match && match[1].trim().toLowerCase() === userEmail.toLowerCase();
            })
            .map(video => ({
                id: video.uri.split('/').pop(),
                customerName: video.name || 'Unknown Customer',
                vimeoLink: video.link,
                createdTime: video.created_time
            }));

        res.json(userVideos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Minimal server running on ${PORT}`);
});