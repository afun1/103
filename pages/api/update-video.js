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

    // Get current video metadata (description)
    const current = await new Promise((resolve, reject) => {
      vimeo.request({ method: 'GET', path: `/videos/${videoId}` }, (err, body, status) => {
        if (err) return reject(err);
        resolve(body || {});
      });
    });

    const oldDescription = (current.description || '').trim();

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

    // Update video description via PATCH
    const updated = await new Promise((resolve, reject) => {
      const body = { description: newDescription };
      vimeo.request({ method: 'PATCH', path: `/videos/${videoId}`, headers: { 'Content-Type': 'application/json' }, query: {}, body: JSON.stringify(body) }, (err, respBody, status) => {
        if (err) return reject(err);
        resolve(respBody || {});
      });
    });

    return res.status(200).json({ success: true, video: updated });
  } catch (error) {
    console.error('Error updating video:', error);
    return res.status(500).json({ error: 'Failed to update video in Vimeo', details: String(error && error.message ? error.message : error) });
  }
}
