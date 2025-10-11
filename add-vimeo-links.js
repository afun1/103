// Add Vimeo links to existing customers in Supabase
import { createClient } from '@supabase/supabase-js';
import { fetchFolderVideos, summarizeCustomersFromVideos } from '@/lib/vimeo.js';

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

async function addVimeoLinksToCustomers() {
  console.log('🔗 Adding Vimeo links to existing customers...');

  try {
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

    for (const [email, customerData] of customerVideos) {
      try {
        // Sort videos by creation date (newest first)
        customerData.videos.sort((a, b) => new Date(b.created) - new Date(a.created));

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
        } else if (data && data.length > 0) {
          console.log(`✅ Updated ${email}: ${customerData.videos.length} videos`);
          updatedCount++;
        } else {
          console.log(`⚠️ No customer found with email: ${email}`);
        }

      } catch (error) {
        console.error(`❌ Error processing ${email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n🎉 Vimeo Links Update Complete!');
    console.log(`   • Customers updated: ${updatedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Total videos processed: ${videos.length}`);

  } catch (error) {
    console.error('❌ Vimeo links update failed:', error);
    process.exit(1);
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

// Run the update
addVimeoLinksToCustomers()
  .then(() => {
    console.log('✅ Vimeo links update script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Vimeo links update script failed:', error);
    process.exit(1);
  });