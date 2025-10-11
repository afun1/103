// Consolidated customers endpoint - now uses customer registry
import { createClient } from '@supabase/supabase-js';
import { getCustomersCache, setCustomersCache, fetchFolderVideos, summarizeCustomersFromVideos } from '@/lib/vimeo';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, supabaseKey);
}
export default async function handler(req, res) {
  console.log('👥 Fetching customers from registry...');

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
    // Try to get from Supabase customer registry first (now our primary source)
    let allCustomers = [];
    try {
      console.log('📋 Fetching from Supabase customer registry...');
      const supabase = getSupabaseClient();

      // Try to select with vimeo_link first, fallback without it
      let { data, error } = await supabase
        .from('customers')
        .select('id, name, email, vimeo_link')
        .order('name');

      if (error && error.message.includes('vimeo_link')) {
        // Fallback to basic fields if vimeo_link column doesn't exist
        console.log('⚠️ vimeo_link column not found, falling back to basic fields');
        const fallback = await supabase
          .from('customers')
          .select('id, name, email')
          .order('name');
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        throw error;
      }

      allCustomers = data || [];
      console.log(`✅ Found ${allCustomers.length} customers in Supabase registry`);
    } catch (registryError) {
      console.log('⚠️ Supabase registry failed, falling back to Vimeo cache:', registryError.message);
      // Fallback to Vimeo cache
      allCustomers = await getCustomersCache(process.env.VIMEO_ACCESS_TOKEN, '26555277');

      if (!allCustomers) {
        // Final fallback to direct Vimeo loading
        console.log('📹 Cache miss, fetching directly from Vimeo...');
        const videos = await fetchFolderVideos(process.env.VIMEO_ACCESS_TOKEN, { folderId: '26555277' });
        allCustomers = summarizeCustomersFromVideos(videos);

        // Update cache with fresh data
        setCustomersCache(process.env.VIMEO_ACCESS_TOKEN, '26918583', allCustomers);
        console.log('💾 Updated cache with fresh Vimeo data');
      }
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const paginatedCustomers = allCustomers.slice(offset, offset + limit);

    console.log(`✅ Retrieved ${allCustomers.length} customers from registry, returning page ${page} (${paginatedCustomers.length} items)`);

    // Add cache headers for edge caching
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // 5 min cache

    return res.status(200).json({
      customers: paginatedCustomers,
      total: allCustomers.length,
      page,
      limit,
      totalPages: Math.ceil(allCustomers.length / limit)
    });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    return res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
  }
}
