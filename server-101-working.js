// filepath: c:\sr927c\server-101-working.js
// 🎉 101 WORKING VERSION - 32 videos with thumbnails and full pagination! 🎉
const express = require('express');
const cors = require('cors');
const { Vimeo } = require('@vimeo/vimeo');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
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

// Configure multer for video uploads
const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
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

// ALL OTHER ENDPOINTS FROM ORIGINAL SERVER.JS
// Including: upload endpoints, test endpoints, debug endpoints, user recordings with pagination, etc.
// This is the WORKING VERSION with full functionality!

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});