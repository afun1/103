import { Vimeo } from '@vimeo/vimeo';

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID;
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET;
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

function getVimeoClient() {
  if (!VIMEO_ACCESS_TOKEN) throw new Error('VIMEO_ACCESS_TOKEN not configured');
  return new Vimeo(VIMEO_CLIENT_ID || '', VIMEO_CLIENT_SECRET || '', VIMEO_ACCESS_TOKEN);
}

async function fetchVttContent(vimeo, trackLink) {
    return new Promise((resolve, reject) => {
        vimeo.request({
            method: 'GET',
            path: trackLink,
        }, (err, body, status, headers) => {
            if (err) return reject(err);
            // The body is the VTT content itself
            resolve(body);
        });
    });
}

function parseVtt(vttContent) {
    const lines = vttContent.split('\n');
    let header = '';
    let body = '';

    const noteIndex = lines.findIndex(line => line.startsWith('NOTE'));
    if (noteIndex !== -1 && lines[noteIndex + 1]) {
        header = lines[noteIndex + 1].trim();
    }

    const timecodeIndex = lines.findIndex(line => line.includes('-->'));
    if (timecodeIndex !== -1 && lines[timecodeIndex + 1]) {
        body = lines.slice(timecodeIndex + 1).join('\n').trim();
    }
    
    return { header, body };
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { videoUri } = req.query;
    if (!videoUri) return res.status(400).json({ error: 'videoUri is required' });

    const vimeo = getVimeoClient();
    const videoId = String(videoUri).split('/').filter(Boolean).pop();
    if (!videoId) return res.status(400).json({ error: 'Invalid videoUri' });

    const tracks = await new Promise((resolve, reject) => {
        vimeo.request({
            method: 'GET',
            path: `/videos/${videoId}/texttracks`,
        }, (err, body) => {
            if (err) return reject(err);
            resolve(body.data || []);
        });
    });

    const commentTracks = tracks.filter(t => t.type === 'metadata');
    
    const comments = await Promise.all(commentTracks.map(async (track) => {
        const vttContent = await fetchVttContent(vimeo, track.link);
        return parseVtt(vttContent);
    }));

    return res.status(200).json({ success: true, comments });

  } catch (error) {
    console.error('Error getting comments:', error);
    return res.status(500).json({ error: 'Failed to get comments from Vimeo' });
  }
}
