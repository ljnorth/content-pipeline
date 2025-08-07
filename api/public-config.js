export default async function handler(req, res) {
  try {
    const cfg = {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      previewBaseUrl: process.env.PREVIEW_BASE_URL || 'https://www.easypost.fun',
      authMode: 'invite',
      brand: {
        name: 'EasyPost',
        tagline: 'Automated content creation for TikTok teams',
      },
      // Invite-only: set INVITE_CODE in env to gate self-serve signup (temporary)
      inviteCode: process.env.INVITE_CODE || null
    };
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


