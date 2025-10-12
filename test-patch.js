const { Vimeo } = require('@vimeo/vimeo');
require('dotenv').config();

const vimeo = new Vimeo(process.env.VIMEO_CLIENT_ID, process.env.VIMEO_CLIENT_SECRET, process.env.VIMEO_ACCESS_TOKEN);
const videoId = '1126537579'; // Use a real video ID from our test

console.log('Testing PATCH on video:', videoId);

vimeo.request({
  method: 'PATCH',
  path: `/videos/${videoId}`,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description: 'Test description update ' + new Date().toISOString() })
}, (err, body, status) => {
  console.log('Status:', status);
  console.log('Error:', err?.message);
  console.log('Response description length:', body?.description?.length);
  console.log('Response description preview:', body?.description?.substring(0, 100));
});