import { fetchFolderVideos, summarizeCustomersFromVideos, VIMEO_DEFAULT_FOLDER_ID } from '@/lib/vimeo';

// Customers endpoint - extracts unique customers from Vimeo videos
export default async function handler(req, res) {
  console.log('👥 Fetching customers...');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
      : req.query.folderId || VIMEO_DEFAULT_FOLDER_ID;

    const videos = await fetchFolderVideos(token, { folderId });

    const customers = summarizeCustomersFromVideos(videos);
    console.log(`✅ Extracted ${customers.length} customers`);

    return res.status(200).json(customers);
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    return res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
  }
}
