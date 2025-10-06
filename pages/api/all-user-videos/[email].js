import { extractVideoMetadata, fetchFolderVideos, VIMEO_DEFAULT_FOLDER_ID } from '@/lib/vimeo';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawEmail = Array.isArray(req.query.email) ? req.query.email[0] : req.query.email;
  if (!rawEmail) {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  const normalizedEmail = String(rawEmail).trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Valid email parameter required' });
  }

  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Vimeo access token not configured' });
    }

    const folderId = Array.isArray(req.query.folderId)
      ? req.query.folderId[0]
      : req.query.folderId || VIMEO_DEFAULT_FOLDER_ID;

    const videos = await fetchFolderVideos(token, { folderId });

    const userVideos = videos
      .map((video) => {
        const metadata = extractVideoMetadata(video.description);
        const recordedByEmail = metadata.recordedByEmail?.toLowerCase() || '';
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
            email: recordedByEmail
          },
          recordingDate: metadata.recordingDate || video?.created_time || null,
          duration: video?.duration ?? null,
          created_time: video?.created_time || null,
          metadata: {
            ...metadata,
            folderId,
            sourceUri: video?.uri || ''
          }
        };
      })
      .filter((video) => video.recordedBy.email === normalizedEmail)
      .sort((a, b) => new Date(b.created_time || 0) - new Date(a.created_time || 0));

    return res.status(200).json(userVideos);
  } catch (error) {
    console.error('❌ Failed to load user videos:', error);
    return res.status(500).json({ error: 'Failed to fetch user videos from Vimeo' });
  }
}
