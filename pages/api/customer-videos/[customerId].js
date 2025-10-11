// API endpoint to get videos for a specific customer
import { fetchFolderVideos } from '@/lib/vimeo.js';

const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
const folderId = process.env.VIMEO_FOLDER_ID || '26555277';

export default async function handler(req, res) {
  const { customerId } = req.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }

  try {
    console.log(`🎥 Fetching videos for customer: ${customerId}`);

    // Fetch all videos from Vimeo
    const videos = await fetchFolderVideos(vimeoToken, { folderId });

    // Filter videos that belong to this customer
    const customerVideos = videos.filter(video => {
      const metadata = extractVideoMetadata(video?.description);
      const email = metadata.customerEmail?.trim();

      // Match by normalized email
      return email && email.toLowerCase() === customerId.toLowerCase();
    });

    // Sort by creation date (newest first)
    customerVideos.sort((a, b) => new Date(b.created_time || 0) - new Date(a.created_time || 0));

    console.log(`✅ Found ${customerVideos.length} videos for customer ${customerId}`);

    return res.status(200).json({
      customerId,
      videos: customerVideos,
      total: customerVideos.length
    });

  } catch (error) {
    console.error('❌ Error fetching customer videos:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer videos',
      details: error.message
    });
  }
}

// Extract video metadata from description (same as in vimeo.js)
function extractVideoMetadata(description) {
  if (!description) return {};

  const metadata = {};

  // Try to extract customer email
  const emailMatch = description.match(/customer[_-]?email:?\s*([^\s\n]+)/i) ||
                    description.match(/email:?\s*([^\s\n]+)/i) ||
                    description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

  if (emailMatch) {
    metadata.customerEmail = emailMatch[1].toLowerCase().trim();
  }

  // Try to extract customer name
  const nameMatch = description.match(/customer:?\s*([^\n]+)/i) ||
                   description.match(/name:?\s*([^\n]+)/i);

  if (nameMatch) {
    metadata.customer = nameMatch[1].trim();
  }

  return metadata;
}