import { createClient } from '@supabase/supabase-js';

function buildSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  try {
    return createClient(url, serviceKey);
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    return null;
  }
}

function calculateRoleStats(users = []) {
  return users.reduce(
    (stats, user) => {
      const role = user.role?.toLowerCase() || 'user';

      if (stats[role] !== undefined) {
        stats[role] += 1;
      } else {
        stats.other += 1;
      }

      return stats;
    },
    { admin: 0, manager: 0, supervisor: 0, user: 0, other: 0 }
  );
}

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

  const supabase = buildSupabaseClient();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured' });
  }

  try {
    console.log('👥 Fetching users from Supabase profiles table...');

    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        display_name,
        email,
        role,
        assigned_to_supervisor,
        assigned_to_manager,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users from Supabase:', error);
      throw error;
    }

    const safeUsers = users || [];
    const roleStats = calculateRoleStats(safeUsers);

    console.log(`✅ Successfully fetched ${safeUsers.length} users from Supabase`);

    return res.status(200).json({
      success: true,
      users: safeUsers,
      total: safeUsers.length,
      stats: {
        totalUsers: safeUsers.length,
        ...roleStats
      }
    });
  } catch (error) {
    console.error('❌ Error in users endpoint:', error);
    return res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
}
