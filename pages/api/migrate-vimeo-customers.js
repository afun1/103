// API endpoint to trigger Vimeo to Supabase customer migration
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
    console.log('🚀 Starting Vimeo to Supabase customer migration via API...');

    // 1. Fetch all videos from Vimeo
    console.log('📹 Fetching videos from Vimeo...');
    const videos = await fetchFolderVideos(vimeoToken, { folderId });
    console.log(`✅ Found ${videos.length} videos in Vimeo`);

    // 2. Extract customer data from videos
    console.log('👥 Extracting customer data from videos...');
    const vimeoCustomers = summarizeCustomersFromVideos(videos);
    console.log(`✅ Extracted ${vimeoCustomers.length} unique customers from Vimeo`);

    if (vimeoCustomers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No customers found in Vimeo videos',
        migrated: 0,
        skipped: 0
      });
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
    let insertedCount = 0;
    if (newCustomers.length > 0) {
      console.log('💾 Inserting customers into Supabase...');

      const { data, error } = await supabase
        .from('customers')
        .upsert(newCustomers, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('❌ Supabase insertion error:', error);
        return res.status(500).json({
          error: 'Failed to migrate customers',
          details: error.message
        });
      }

      insertedCount = data.length;
      console.log(`✅ Successfully migrated ${insertedCount} customers to Supabase`);
    }

    return res.status(200).json({
      success: true,
      message: `Migrated ${insertedCount} customers from Vimeo to Supabase`,
      migrated: insertedCount,
      skipped: existingCount,
      totalVimeoCustomers: vimeoCustomers.length
    });

  } catch (error) {
    console.error('❌ Migration API error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      details: error.message
    });
  }
}