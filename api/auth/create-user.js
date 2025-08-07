import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password, inviteCode } = req.body || {};
    if (!email || !password || !inviteCode) return res.status(400).json({ error: 'email, password, inviteCode required' });
    if (inviteCode !== (process.env.INVITE_MASTER_PASSWORD || 'Aesthetic2025')) return res.status(403).json({ error: 'Invalid invite code' });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return res.status(400).json({ error: error.message });
    // Upsert user profile
    await supabaseAdmin.from('user_profiles').upsert({ user_id: data.user.id, email, role: 'user', last_login: new Date().toISOString() });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


