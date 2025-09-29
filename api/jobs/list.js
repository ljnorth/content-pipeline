import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res){
  try{
    if (req.method !== 'GET') { res.setHeader('Allow',['GET']); return res.status(405).json({ error:'Method not allowed' }); }
    const db = new SupabaseClient();
    const { data, error } = await db.client
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  }catch(e){ res.status(500).json({ error: e.message }); }
}


