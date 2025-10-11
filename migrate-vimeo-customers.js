// One-time migration script to populate Supabase customers table with Vimeo data
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

async function migrateVimeoCustomersToSupabase() {
  console.log('🚀 Starting Vimeo to Supabase customer migration...');

  try {
    // 1. Fetch all videos from Vimeo
    console.log('📹 Fetching videos from Vimeo...');
    const videos = await fetchFolderVideos(vimeoToken, { folderId });
    console.log(`✅ Found ${videos.length} videos in Vimeo`);

    // 2. Extract customer data from videos
    console.log('👥 Extracting customer data from videos...');
    const vimeoCustomers = summarizeCustomersFromVideos(videos);
    console.log(`✅ Extracted ${vimeoCustomers.length} unique customers from Vimeo`);

    if (vimeoCustomers.length === 0) {
      console.log('⚠️ No customers found in Vimeo videos');
      return;
    }

    // 3. Transform to Supabase format - only use columns that exist
    const supabaseCustomers = vimeoCustomers.map(customer => ({
      id: customer.email.toLowerCase().trim(),
      name: customer.name || 'Unknown Customer',
      email: customer.email.toLowerCase().trim()
      // Note: videos and updated_at columns don't exist in current table
    }));

    // 4. Connect to Supabase
    const supabase = getSupabaseClient();

    // 5. Check existing customers to avoid duplicates
    console.log('🔍 Checking for existing customers in Supabase...');
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('email');

    const existingEmails = new Set(existingCustomers?.map(c => c.email.toLowerCase()) || []);
    const newCustomers = supabaseCustomers.filter(c => !existingEmails.has(c.email));
    const existingCount = supabaseCustomers.length - newCustomers.length;

    console.log(`📊 Migration stats: ${newCustomers.length} new customers, ${existingCount} already exist`);

    // 6. Bulk insert new customers
    if (newCustomers.length > 0) {
      console.log('💾 Inserting customers into Supabase...');

      const { data, error } = await supabase
        .from('customers')
        .upsert(newCustomers, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('❌ Supabase insertion error:', error);
        throw error;
      }

      console.log(`✅ Successfully migrated ${data.length} customers to Supabase`);
    }

    // 7. Summary
    console.log('\n🎉 Migration Complete!');
    console.log(`   • Total Vimeo customers found: ${vimeoCustomers.length}`);
    console.log(`   • New customers added: ${newCustomers.length}`);
    console.log(`   • Existing customers skipped: ${existingCount}`);
    console.log(`   • Total customers in Supabase: ${existingCount + newCustomers.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateVimeoCustomersToSupabase()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });