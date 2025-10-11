// Check customers table structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

async function checkTableStructure() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not configured');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Try to get table structure by attempting different queries
    console.log('🔍 Checking customers table structure...');

    // Try to select all columns
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing customers table:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Current table structure (based on first row):');
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample data:', data[0]);
    } else {
      console.log('📋 Table exists but is empty');
    }

    // Provide the SQL to fix the table structure
    console.log('\n🔧 Run this SQL in your Supabase SQL editor to fix the customers table:');
    console.log(`
-- Fix customers table structure
-- First, check current structure and backup if needed

-- Add missing columns
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS vimeo_link TEXT,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create proper primary key if needed
-- If id column exists and should be the primary key:
-- ALTER TABLE customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

-- Add unique constraint on email if needed
-- ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_vimeo_link ON customers(vimeo_link);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Allow read access to customers" ON customers
  FOR SELECT USING (true);

CREATE POLICY "Allow write access to customers" ON customers
  FOR ALL USING (auth.role() = 'authenticated');
    `);

  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await checkTableStructure();
  return res.status(200).json({ message: 'Check console for table structure and SQL commands' });
}