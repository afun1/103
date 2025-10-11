// Bulk import customers API - handles CSV/JSON import to Supabase
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
    const supabase = getSupabaseClient();
    const { customers } = req.body;

    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: 'Customers must be an array' });
    }

    if (customers.length === 0) {
      return res.status(400).json({ error: 'No customers to import' });
    }

    console.log(`📥 Starting bulk import of ${customers.length} customers...`);

    // Validate and normalize customer data
    const validCustomers = [];
    const errors = [];

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      if (!customer.email || typeof customer.email !== 'string') {
        errors.push(`Row ${i + 1}: Missing or invalid email`);
        continue;
      }

      const normalizedEmail = customer.email.toLowerCase().trim();

      if (!normalizedEmail.includes('@')) {
        errors.push(`Row ${i + 1}: Invalid email format: ${customer.email}`);
        continue;
      }

      validCustomers.push({
        id: normalizedEmail,
        name: (customer.name || '').trim() || 'Unknown Customer',
        email: normalizedEmail,
        videos: customer.videos || [],
        vimeo_link: customer.vimeo_link || null,
        updated_at: new Date().toISOString()
      });
    }

    if (validCustomers.length === 0) {
      return res.status(400).json({
        error: 'No valid customers to import',
        details: errors
      });
    }

    // Check for existing customers to avoid duplicates
    const emails = validCustomers.map(c => c.email);
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('email')
      .in('email', emails);

    const existingEmails = new Set(existingCustomers?.map(c => c.email) || []);
    const newCustomers = validCustomers.filter(c => !existingEmails.has(c.email));
    const duplicateCount = validCustomers.length - newCustomers.length;

    console.log(`📊 Import stats: ${newCustomers.length} new, ${duplicateCount} duplicates`);

    // Bulk insert new customers
    if (newCustomers.length > 0) {
      const { data, error } = await supabase
        .from('customers')
        .upsert(newCustomers, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('Supabase bulk insert error:', error);
        return res.status(500).json({
          error: 'Failed to import customers',
          details: error.message
        });
      }

      console.log(`✅ Successfully imported ${data.length} customers`);
    }

    return res.status(200).json({
      success: true,
      imported: newCustomers.length,
      duplicates: duplicateCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Imported ${newCustomers.length} customers${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''}`
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}