// API endpoint to add Vimeo links to existing customers
import { createClient } from '@supabase/supabase-js';
import { fetchFolderVideos } from '@/lib/vimeo.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;
const folderId = process.env.VIMEO_FOLDER_ID || '26555277';

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔗 Adding Vimeo links to existing customers...');

    // 1. Fetch all videos from Vimeo
    console.log('📹 Fetching all videos from Vimeo...');
    const videos = await fetchFolderVideos(vimeoToken, { folderId });
    console.log(`✅ Found ${videos.length} videos`);

    // 2. Group videos by customer email
    const customerVideos = new Map();

    videos.forEach((video) => {
      const metadata = extractVideoMetadata(video?.description);
      const email = metadata.customerEmail?.trim();

      if (!email) return;

      const normalizedEmail = email.toLowerCase();
      const videoLink = video?.link || `https://vimeo.com/${video?.uri?.split('/').pop()}`;

      if (!customerVideos.has(normalizedEmail)) {
        customerVideos.set(normalizedEmail, {
          email: normalizedEmail,
          name: metadata.customer || video?.name || 'Unknown Customer',
          videos: []
        });
      }

      customerVideos.get(normalizedEmail).videos.push({
        link: videoLink,
        title: video?.name || 'Untitled',
        created: video?.created_time,
        uri: video?.uri
      });
    });

    console.log(`✅ Grouped videos for ${customerVideos.size} customers`);

    // 3. Connect to Supabase
    const supabase = getSupabaseClient();

    // 4. Update each customer with their Vimeo links
    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const [email, customerData] of customerVideos) {
      try {
        // Sort videos by creation date (newest first)
        customerData.videos.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));

        // Prepare update data
        const updateData = {
          vimeo_link: customerData.videos[0]?.link || null, // Most recent video link
          videos: customerData.videos.map(v => v.link) // Array of all video links
        };

        const { data, error } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', email)
          .select();

        if (error) {
          console.error(`❌ Error updating ${email}:`, error.message);
          errorCount++;
          results.push({ email, status: 'error', error: error.message });
        } else if (data && data.length > 0) {
          console.log(`✅ Updated ${email}: ${customerData.videos.length} videos`);
          updatedCount++;
          results.push({
            email,
            status: 'success',
            videosCount: customerData.videos.length,
            latestVideo: customerData.videos[0]?.link
          });
        } else {
          console.log(`⚠️ No customer found with email: ${email}`);
          results.push({ email, status: 'not_found' });
        }

      } catch (error) {
        console.error(`❌ Error processing ${email}:`, error.message);
        errorCount++;
        results.push({ email, status: 'error', error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated Vimeo links for ${updatedCount} customers`,
      updated: updatedCount,
      errors: errorCount,
      totalProcessed: customerVideos.size,
      results: results
    });

  } catch (error) {
    console.error('❌ Vimeo links update API error:', error);
    return res.status(500).json({
      error: 'Failed to add Vimeo links',
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