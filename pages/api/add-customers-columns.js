// Add missing columns to customers table
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔧 Adding missing columns to customers table...');

    // Note: This would normally be done with SQL ALTER TABLE statements
    // Since we can't run raw SQL from the API, we'll provide the SQL commands
    // that need to be run in the Supabase SQL editor

    const sqlCommands = [
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}';`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS vimeo_link TEXT;`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
      `ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`
    ];

    console.log('📋 Please run these SQL commands in your Supabase SQL editor:');
    sqlCommands.forEach((sql, index) => {
      console.log(`${index + 1}. ${sql}`);
    });

    return res.status(200).json({
      success: true,
      message: 'SQL commands generated for adding missing columns',
      sqlCommands: sqlCommands,
      instructions: 'Run these commands in your Supabase SQL editor to add the missing columns to the customers table.'
    });

  } catch (error) {
    console.error('❌ Error generating column addition SQL:', error);
    return res.status(500).json({
      error: 'Failed to generate column addition SQL',
      details: error.message
    });
  }
}