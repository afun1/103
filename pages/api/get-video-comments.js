import { Vimeo } from '@vimeo/vimeo';

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID;
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET;
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

function getVimeoClient() {
  if (!VIMEO_ACCESS_TOKEN) throw new Error('VIMEO_ACCESS_TOKEN not configured');
  return new Vimeo(VIMEO_CLIENT_ID || '', VIMEO_CLIENT_SECRET || '', VIMEO_ACCESS_TOKEN);
}

function parseCommentsFromDescription(description) {
  if (!description) return [];

  console.log('🔍 Raw description:', description);
  const comments = [];
  // Split by comment separator lines that start with "---"
  const parts = description.split(/\n\s*---\s*/);
  console.log('🔍 Split parts:', parts.length, parts);

  // The first part is the original description, skip it
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    console.log(`🔍 Processing part ${i}:`, part);
    // Extract header and body
    const lines = part.split('\n');
    const header = lines[0] || '';
    const body = lines.slice(1).join('\n').trim();

    console.log(`🔍 Header: "${header}", Body: "${body}"`);
    if (body) {
      comments.push({ header, body });
    }
  }

  console.log('📋 Final comments:', comments);
  return comments;
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

    // Get video metadata including description
    const video = await new Promise((resolve, reject) => {
      vimeo.request({ method: 'GET', path: `/videos/${videoId}` }, (err, body) => {
        if (err) return reject(err);
        resolve(body);
      });
    });

    const comments = parseCommentsFromDescription(video.description || '');
    console.log(`📋 Found ${comments.length} comments in video description`);

    return res.status(200).json({ success: true, comments });
  } catch (error) {
    console.error('Error getting video comments:', error);
    return res.status(500).json({ error: 'Failed to get comments from Vimeo' });
  }
}