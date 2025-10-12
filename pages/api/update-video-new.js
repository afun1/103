import { Vimeo } from '@vimeo/vimeo';

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID;
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET;
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

function getVimeoClient() {
  if (!VIMEO_ACCESS_TOKEN) throw new Error('VIMEO_ACCESS_TOKEN not configured');
  return new Vimeo(VIMEO_CLIENT_ID || '', VIMEO_CLIENT_SECRET || '', VIMEO_ACCESS_TOKEN);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { videoUri, comment, commenterName, commenterEmail, commentDate, actualActorName, actualActorEmail } = req.body || {};
    if (!videoUri || !comment) return res.status(400).json({ error: 'videoUri and comment are required' });

    const vimeo = getVimeoClient();

    // Extract video ID from uri like '/videos/12345' or full URL
    const videoId = String(videoUri).split('/').filter(Boolean).pop();
    if (!videoId) return res.status(400).json({ error: 'Invalid videoUri' });

    // Get current video metadata (description) - this is required!
    const current = await new Promise((resolve, reject) => {
      vimeo.request({ method: 'GET', path: `/videos/${videoId}` }, (err, body, status) => {
        if (err) {
          console.log('⚠️ Could not fetch current video metadata:', err.message);
          // Don't fail - continue with empty description
          resolve({ description: '' });
        } else {
          resolve(body || {});
        }
      });
    });

    const oldDescription = (current.description || '').trim();
    console.log('🔍 Current video description length:', oldDescription.length);
    console.log('🔍 Current video description preview:', oldDescription.substring(0, 200) + '...');

    // Build appended comment block. Put commenter metadata in header, but ensure the
    // comment body appears as part of the user content so it will display in the UI.
    const when = commentDate || new Date().toISOString();
    const headerParts = [];
    if (commenterName) headerParts.push(`${commenterName}`);
    if (commenterEmail) headerParts.push(`<${commenterEmail}>`);
    const header = headerParts.length ? `${headerParts.join(' ')} at ${when}` : `Comment at ${when}`;

    // Build appended comment block. We intentionally do NOT add any extra audit lines
    // so the by-line provided will stand as entered.
    const appended = `\n\n--- ${header} ---\n${comment}`;
    const newDescription = (oldDescription ? oldDescription + appended : appended);

    console.log('📝 Appended comment block:', appended);
    console.log('📝 New description length:', newDescription.length);
    console.log('📝 New description preview:', newDescription.substring(0, 300) + '...');

    // Update video description via PATCH
    console.log('🔄 Making PATCH request to Vimeo for video:', videoId);
    const updated = await new Promise((resolve, reject) => {
      const updateData = {
        description: newDescription
      };
      console.log('📡 PATCH payload length:', newDescription.length);
      console.log('📡 PATCH payload preview:', newDescription.substring(Math.max(0, newDescription.length - 200)));

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('⏰ PATCH request timed out after 10 seconds');
        reject(new Error('Request timeout'));
      }, 10000);

      vimeo.request({
        method: 'PATCH',
        path: `/videos/${videoId}`,
        query: updateData  // Use query instead of body
      }, (err, respBody, status, headers) => {
        clearTimeout(timeout);
        console.log('📡 Vimeo PATCH response status:', status);
        console.log('📡 Vimeo PATCH response headers:', headers);
        if (err) {
          console.error('❌ Vimeo PATCH error:', err);
          return reject(err);
        }
        console.log('✅ Vimeo PATCH response body keys:', respBody ? Object.keys(respBody) : 'null');
        console.log('✅ Updated description length:', (respBody?.description || '').length);
        resolve(respBody || {});
      });
    });

    return res.status(200).json({ success: true, video: updated });
  } catch (error) {
    console.error('Error updating video:', error);
    return res.status(500).json({ error: 'Failed to update video in Vimeo', details: String(error && error.message ? error.message : error) });
  }
}