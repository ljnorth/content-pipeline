import { SupabaseClient } from '../src/database/supabase-client.js';

const db = new SupabaseClient();

export default async function handler(req, res) {
  // Set CORS headers for client-side requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Extract batchId from URL path for Vercel dynamic routes
  let batchId;
  try {
    const urlParts = req.url.split('/');
    batchId = urlParts[urlParts.length - 1];
    
    // Remove query parameters if present
    if (batchId.includes('?')) {
      batchId = batchId.split('?')[0];
    }
  } catch (error) {
    console.error('Error extracting batchId:', error);
    batchId = null;
  }

  if (!batchId) {
    res.status(400).json({ error: 'No batch ID provided' });
    return;
  }

  try {
    // Get batch data from database
    const { data: batch, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (error || !batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Return clean JSON data
    res.status(200).json({
      success: true,
      batch: {
        id: batch.preview_id,
        accountUsername: batch.account_username,
        createdAt: batch.created_at,
        posts: batch.posts || []
      }
    });

  } catch (error) {
    console.error('Preview data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 