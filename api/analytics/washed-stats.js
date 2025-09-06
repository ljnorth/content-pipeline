import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    const db = new SupabaseClient();
    const { data, error } = await db.client
      .from('images')
      .select('washed', { count: 'exact', head: true });
    const total = data ? data.length : null; // head:true returns no rows; use aggregate queries instead

    // Use two separate count queries for clarity
    const { count: totalCount } = await db.client.from('images').select('*', { count: 'exact', head: true });
    const { count: washedCount } = await db.client.from('images').select('*', { count: 'exact', head: true }).eq('washed', true);
    const { count: unwashedCount } = await db.client.from('images').select('*', { count: 'exact', head: true }).eq('washed', false);

    // Also sample a few unwashed if any
    let sample = [];
    if ((unwashedCount || 0) > 0) {
      const { data: rows } = await db.client
        .from('images')
        .select('id, username, post_id, image_path')
        .eq('washed', false)
        .limit(5);
      sample = rows || [];
    }

    res.json({ total: totalCount || 0, washed: washedCount || 0, unwashed: unwashedCount || 0, sample });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


