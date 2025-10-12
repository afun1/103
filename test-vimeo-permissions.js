// Test script to check Vimeo API permissions
const { Vimeo } = require('@vimeo/vimeo');
require('dotenv').config();

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID;
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET;
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

async function testVimeoPermissions() {
  console.log('🧪 Testing Vimeo API permissions...');

  const vimeo = new Vimeo(VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN);

  try {
    // Check /me endpoint
    const me = await new Promise((resolve, reject) => {
      vimeo.request({ method: 'GET', path: '/me' }, (err, body, status) => {
        if (err) return reject(err);
        resolve(body);
      });
    });

    console.log('✅ /me response:', {
      name: me.name,
      uri: me.uri,
      account: me.account,
      can_edit: me.can_edit
    });

    // Try to get a specific video
    const videoId = '123456789'; // Test video ID
    const video = await new Promise((resolve, reject) => {
      vimeo.request({ method: 'GET', path: `/videos/${videoId}` }, (err, body, status) => {
        if (err) {
          console.log('❌ Video GET error:', err);
          return resolve(null);
        }
        resolve(body);
      });
    });

    // Try to get videos from the folder
    const folderId = process.env.VIMEO_FOLDER_ID || '26555277';
    console.log('🔍 Checking folder:', folderId);
    
    const folderVideos = await new Promise((resolve, reject) => {
      vimeo.request({ method: 'GET', path: `/me/folders/${folderId}/videos` }, (err, body, status) => {
        if (err) {
          console.log('❌ Folder videos GET error:', err);
          return resolve(null);
        }
        resolve(body);
      });
    });

    if (folderVideos && folderVideos.data) {
      console.log(`✅ Found ${folderVideos.data.length} videos in folder`);
      
      // Check privacy settings of first few videos
      for (let i = 0; i < Math.min(3, folderVideos.data.length); i++) {
        const video = folderVideos.data[i];
        console.log(`📹 Video ${i+1}:`, {
          name: video.name,
          uri: video.uri,
          privacy: video.privacy,
          status: video.status,
          can_edit: video.can_edit
        });
      }

      console.log('� Videos are accessible via folder but not direct GET - this suggests permission restrictions');
      console.log('� The PATCH "success" but no changes might be due to the same permission issue');
    } else {
      console.log('❌ No videos found in folder or folder not accessible');
    }

  } catch (error) {
    console.error('💥 Vimeo API test ERROR:', error);
  }
}

testVimeoPermissions();