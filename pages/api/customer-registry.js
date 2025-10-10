// Customer registry API - stores customers in Supabase with video tracking
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabaseClient();

    if (req.method === 'POST') {
      // Add or update customer
      const { name, email, videoUri, recordedBy } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // First, get existing customer to preserve video list
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('videos')
        .eq('id', normalizedEmail)
        .single();

      const currentVideos = existingCustomer?.videos || [];

      const customerData = {
        id: normalizedEmail,
        name: (name || '').trim() || 'Unknown Customer',
        email: normalizedEmail,
        videos: videoUri ? [...currentVideos, videoUri] : currentVideos,
        updated_at: new Date().toISOString()
      };

      // Upsert customer
      const { data, error } = await supabase
        .from('customers')
        .upsert(customerData, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('Supabase upsert error:', error);
        return res.status(500).json({ error: 'Failed to save customer', details: error.message });
      }

      console.log(`✅ Customer registry updated: ${customerData.name} (${customerData.email}) - ${customerData.videos.length} videos`);
      return res.status(200).json({ success: true, customer: data[0] });

    } else if (req.method === 'GET') {
      // Get all customers
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, videos')
        .order('name');

      if (error) {
        console.error('Supabase select error:', error);
        return res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
      }

      console.log(`📋 Retrieved ${data.length} customers from registry`);
      return res.status(200).json(data);

    } else if (req.method === 'DELETE') {
      // Delete customer (admin only)
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', email.toLowerCase().trim());

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({ error: 'Failed to delete customer', details: error.message });
      }

      console.log(`🗑️ Deleted customer: ${email}`);
      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Customer registry error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}