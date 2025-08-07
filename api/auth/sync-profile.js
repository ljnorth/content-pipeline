import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { user_id, email } = req.body || {};
    if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' });
    await supabaseAdmin.from('user_profiles').upsert({ user_id, email, last_login: new Date().toISOString() });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


