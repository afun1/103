import { fetchFolderVideos, summarizeCustomersFromVideos, VIMEO_DEFAULT_FOLDER_ID } from '@/lib/vimeo';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Vimeo access token not configured' });
    }

    const folderId = Array.isArray(req.query.folderId)
      ? req.query.folderId[0]
      : req.query.folderId || VIMEO_DEFAULT_FOLDER_ID || '26555277';

    console.log(`🎯 Getting customers from Vimeo folder: ${folderId}`);

    const videos = await fetchFolderVideos(token, { folderId });
    console.log(`📊 Total videos from folder ${folderId}: ${videos.length}`);

    const customers = summarizeCustomersFromVideos(videos);
    console.log(`✅ Returning ${customers.length} unique customers from folder`);

    return res.status(200).json(customers);
  } catch (error) {
    console.error('❌ Error fetching folder videos:', error);
    return res.status(500).json({
      error: 'Failed to fetch folder videos',
      message: error.message
    });
  }
}