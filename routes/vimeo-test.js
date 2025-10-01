const express = require('express');
const router = express.Router();

// Test Vimeo API connection endpoint
router.get('/test-vimeo', async (req, res) => {
    console.log('🧪 Testing Vimeo API connection...');
    
    try {
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
        
        // Test basic API connection
        const testResponse = await fetch('https://api.vimeo.com/me', {
            headers: {
                'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!testResponse.ok) {
            const errorText = await testResponse.text();
            return res.json({
                success: false,
                error: `Vimeo API authentication failed: ${testResponse.status} ${testResponse.statusText}`,
                details: errorText,
                tokenPreview: VIMEO_ACCESS_TOKEN.substring(0, 10) + '...'
            });
        }
        
        const userData = await testResponse.json();
        
        // Test folder access
        let folderTest = null;
        try {
            const folderResponse = await fetch(`https://api.vimeo.com/me/projects/${VIMEO_FOLDER_ID}`, {
                headers: {
                    'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (folderResponse.ok) {
                folderTest = await folderResponse.json();
            } else {
                folderTest = { error: `Folder access failed: ${folderResponse.status}` };
            }
        } catch (e) {
            folderTest = { error: e.message };
        }
        
        res.json({
            success: true,
            message: 'Vimeo API connection successful',
            user: {
                name: userData?.name || 'Unknown User',
                uri: userData?.uri || 'Unknown URI',
                account: userData?.account || 'Unknown Account'
            },
            folder: folderTest,
            config: {
                tokenPreview: VIMEO_ACCESS_TOKEN.substring(0, 10) + '...',
                folderId: VIMEO_FOLDER_ID
            }
        });
        
    } catch (error) {
        console.error('❌ Vimeo test error:', error);
        res.json({
            success: false,
            error: error.message,
            details: 'Check server logs for full error details'
        });
    }
});

module.exports = router;