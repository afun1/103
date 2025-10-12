import { Vimeo } from '@vimeo/vimeo';
import { Readable } from 'stream';

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID;
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET;
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

function getVimeoClient() {
  if (!VIMEO_ACCESS_TOKEN) throw new Error('VIMEO_ACCESS_TOKEN not configured');
  return new Vimeo(VIMEO_CLIENT_ID || '', VIMEO_CLIENT_SECRET || '', VIMEO_ACCESS_TOKEN);
}

function generateVtt(comment) {
    const { commenterName, commenterEmail, commentDate, commentBody } = comment;
    const when = commentDate || new Date().toISOString();
    const header = `${commenterName} <${commenterEmail}> at ${when}`;
    // For metadata tracks, a simple note might be better.
    return `WEBVTT

NOTE
${header}

${commentBody}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { videoUri, ...commentData } = req.body || {};
    if (!videoUri || !commentData.commentBody) return res.status(400).json({ error: 'videoUri and commentBody are required' });

    const vimeo = getVimeoClient();
    const videoId = String(videoUri).split('/').filter(Boolean).pop();
    if (!videoId) return res.status(400).json({ error: 'Invalid videoUri' });

    const vttContent = generateVtt(commentData);
    const trackName = `Comment by ${commentData.commenterName || 'Anonymous'} at ${new Date().toISOString()}`;

    const uploadParams = {
        method: 'POST',
        path: `/videos/${videoId}/texttracks`,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            active: true,
            name: trackName,
            language: 'en',
            type: 'metadata'
        }
    };

    const track = await new Promise((resolve, reject) => {
        vimeo.request(uploadParams, (err, body, statusCode) => {
            if (err) {
                console.error(`Vimeo API Error (${statusCode}):`, err.message);
                console.error('Error Body:', err.body);
                return reject(err);
            }
            resolve(body);
        });
    });

    const trackLink = track.link;
    if (!trackLink) {
        throw new Error('Failed to get text track upload link from Vimeo.');
    }

    const vttStream = new Readable();
    vttStream.push(vttContent);
    vttStream.push(null);

    await new Promise((resolve, reject) => {
        const uploadRequest = {
            method: 'PUT',
            path: trackLink,
            headers: { 'Content-Type': 'text/vtt' },
            body: vttStream
        };
        vimeo.request(uploadRequest, (err, body) => {
            if (err) return reject(err);
            resolve(body);
        });
    });

    return res.status(200).json({ success: true, track });

  } catch (error) {
    console.error('Error adding comment text track:', error);
    const errorMessage = error.message || 'An unknown error occurred';
    const errorDetails = error.body ? JSON.stringify(error.body, null, 2) : 'No details';
    console.error('Error details:', errorDetails);
    return res.status(500).json({ error: 'Failed to add comment to Vimeo', details: errorMessage, vimeo_response: error.body });
  }
}
