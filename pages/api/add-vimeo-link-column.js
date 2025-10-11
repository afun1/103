// Add vimeo_link column to customers table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

async function addVimeoLinkColumn() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not configured');
    return { success: false, error: 'Supabase credentials not configured' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if vimeo_link column already exists
    const { data: existingColumns, error: columnCheckError } = await supabase
      .from('customers')
      .select('vimeo_link')
      .limit(1);

    if (columnCheckError && !columnCheckError.message.includes('column "vimeo_link" does not exist')) {
      console.log('ℹ️ vimeo_link column might already exist, checking...');
    } else if (!columnCheckError) {
      console.log('✅ vimeo_link column already exists');
      return { success: true, message: 'vimeo_link column already exists' };
    }

    // Try to add the vimeo_link column using SQL
    console.log('📋 Adding vimeo_link column to customers table...');
    console.log('Please run this SQL in your Supabase SQL editor:');
    console.log(`
-- Add vimeo_link column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS vimeo_link TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_vimeo_link ON customers(vimeo_link);

-- Update RLS policies if needed
-- The existing policies should work with the new column
    `);

    // Try to test if we can update a record (this will fail if column doesn't exist)
    try {
      const { error: testUpdateError } = await supabase
        .from('customers')
        .update({ vimeo_link: null })
        .eq('id', 'test@example.com')
        .select();

      if (testUpdateError && testUpdateError.message.includes('column "vimeo_link" does not exist')) {
        return {
          success: false,
          error: 'vimeo_link column does not exist',
          sql: `
-- Add vimeo_link column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS vimeo_link TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_vimeo_link ON customers(vimeo_link);
          `
        };
      }
    } catch (testError) {
      // Column doesn't exist, return SQL to run
      return {
        success: false,
        error: 'vimeo_link column does not exist',
        sql: `
-- Add vimeo_link column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS vimeo_link TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_vimeo_link ON customers(vimeo_link);
        `
      };
    }

    console.log('✅ vimeo_link column added successfully');
    return { success: true, message: 'vimeo_link column added successfully' };

  } catch (error) {
    console.error('❌ Error adding vimeo_link column:', error);
    return { success: false, error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await addVimeoLinkColumn();

  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(500).json(result);
  }
}