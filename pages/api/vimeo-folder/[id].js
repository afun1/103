import { extractVideoMetadata, fetchFolderVideos } from '@/lib/vimeo';

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

  const folderId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!folderId) {
    return res.status(400).json({ error: 'Folder id required' });
  }

  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Vimeo access token not configured' });
    }

    const videos = await fetchFolderVideos(token, { folderId });

    const transformed = videos.map((video) => {
      const metadata = extractVideoMetadata(video?.description);
      const videoId = video?.uri?.split('/')?.pop?.() || '';

      return {
        id: videoId,
        name: video?.name || metadata.customer || 'Untitled Recording',
        customerName: video?.name || metadata.customer || 'Unknown Customer',
        customerEmail: metadata.customerEmail || '',
        description: video?.description || '',
        vimeoLink: video?.link || (videoId ? `https://vimeo.com/${videoId}` : ''),
        thumbnail: video?.pictures?.sizes?.[0]?.link || null,
        recordedBy: {
          displayName: metadata.recordedBy || '',
          email: metadata.recordedByEmail || ''
        },
        recordingDate: metadata.recordingDate || video?.created_time || null,
        duration: video?.duration ?? null,
        created_time: video?.created_time || null,
        metadata: {
          ...metadata,
          sourceUri: video?.uri || ''
        }
      };
    });

    return res.status(200).json(transformed);
  } catch (error) {
    console.error('❌ Error fetching folder videos:', error);
    return res.status(500).json({
      error: 'Failed to fetch folder videos',
      details: error.message
    });
  }
}
