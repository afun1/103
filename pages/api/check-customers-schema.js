// Check current customers table schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    // Get a sample row to see the schema
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .limit(1);

    if (error) {
      return res.status(500).json({ error: 'Failed to query customers table', details: error });
    }

    // Also get the count
    const { count, error: countError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    return res.status(200).json({
      schema: data && data.length > 0 ? Object.keys(data[0]) : [],
      sampleRow: data && data.length > 0 ? data[0] : null,
      totalRows: count || 0,
      error: countError
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}