import { getCustomersCache, setCustomersCache, fetchFolderVideos, summarizeCustomersFromVideos } from '@/lib/vimeo';

// Consolidated customers endpoint - now uses customer registry
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
    // Try to get from Vimeo cache first (for speed)
    let allCustomers = await getCustomersCache(process.env.VIMEO_ACCESS_TOKEN, '26555277');

    if (!allCustomers) {
      // Fallback to registry API
      console.log('📋 Cache miss, fetching from registry...');
      try {
        const registryResp = await fetch(`${req.protocol || 'http'}://${req.headers.host}/api/customer-registry`);
        if (!registryResp.ok) {
          throw new Error(`Registry API failed: ${registryResp.status}`);
        }
        allCustomers = await registryResp.json();
        
        // Update cache
        setCustomersCache(process.env.VIMEO_ACCESS_TOKEN, '26918583', allCustomers);
        console.log('💾 Updated cache with registry data');
      } catch (registryError) {
        console.log('⚠️ Registry API failed, falling back to direct Vimeo loading:', registryError.message);
        // Fallback to direct Vimeo loading
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
