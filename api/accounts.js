import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res) {
  const db = new SupabaseClient();

  try {
    if (req.method === 'GET') {
      const { data: accounts, error } = await db.client
        .from('account_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json(accounts || []);
    }

    if (req.method === 'POST') {
      const { username, goal, audience, ownerSlackId, ownerDisplayName, autogenEnabled, preferredGender } = req.body || {};
      if (!username) return res.status(400).json({ error: 'username is required' });

      const profile = {
        username,
        is_active: true,
        owner_slack_id: ownerSlackId || null,
        owner_display_name: ownerDisplayName || null,
        content_strategy: {
          goal: goal || null,
          audience: audience || null,
          aestheticFocus: [],
          autogenEnabled: !!autogenEnabled,
          preferredGender: ['men','women','any'].includes(preferredGender) ? preferredGender : 'any'
        }
      };

      const { error } = await db.client.from('account_profiles').upsert(profile);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (req.method === 'PATCH') {
      const { username, autogenEnabled, preferredGender } = req.body || {};
      if (!username) return res.status(400).json({ error: 'username is required' });

      // merge flag into content_strategy JSON
      const { data: existing, error: fetchErr } = await db.client
        .from('account_profiles')
        .select('content_strategy')
        .eq('username', username)
        .single();
      if (fetchErr) throw fetchErr;

      const content_strategy = Object.assign(
        {},
        existing?.content_strategy || {},
        {
          autogenEnabled: typeof autogenEnabled === 'boolean' ? autogenEnabled : (existing?.content_strategy?.autogenEnabled ?? false),
          preferredGender: ['men','women','any'].includes(preferredGender) ? preferredGender : (existing?.content_strategy?.preferredGender || 'any')
        }
      );

      const { error } = await db.client
        .from('account_profiles')
        .update({ content_strategy })
        .eq('username', username);
      if (error) throw error;
      return res.json({ success: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


