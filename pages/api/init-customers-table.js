// Initialize customer registry table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

async function initCustomerTable() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not configured');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Create customers table if it doesn't exist
    const { error } = await supabase.rpc('create_customers_table', {});

    if (error && !error.message.includes('already exists')) {
      console.error('❌ Failed to create customers table:', error);
      return;
    }

    console.log('✅ Customers table ready');
  } catch (error) {
    console.log('ℹ️ Table might already exist or RPC not available, trying direct approach...');

    // Try to insert a test record to see if table exists
    try {
      const { error: testError } = await supabase
        .from('customers')
        .select('id')
        .limit(1);

      if (testError) {
        console.log('📋 Creating customers table...');
        console.log('Please run this SQL in your Supabase SQL editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  videos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies if needed
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow read access to customers" ON customers
  FOR SELECT USING (true);

-- Allow insert/update for authenticated users (adjust as needed)
CREATE POLICY "Allow write access to customers" ON customers
  FOR ALL USING (auth.role() = 'authenticated');
        `);
      } else {
        console.log('✅ Customers table already exists');
      }
    } catch (testError) {
      console.error('❌ Error checking table:', testError);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await initCustomerTable();
  return res.status(200).json({ success: true, message: 'Customer table initialization attempted' });
}