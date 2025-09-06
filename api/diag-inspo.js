import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    const { username, windowDays: wd } = req.query || {};
    if (!username) return res.status(400).json({ error: 'username required' });

    const db = new SupabaseClient();

    // Read profile for inspo + gender
    const { data: prof } = await db.client
      .from('account_profiles')
      .select('*')
      .eq('username', username.replace('@',''))
      .single();

    const windowDays = Number(wd || prof?.content_strategy?.anchorSettings?.windowDays || 90);
    const inspo = Array.isArray(prof?.inspo_accounts) && prof.inspo_accounts.length
      ? prof.inspo_accounts
      : (Array.isArray(prof?.content_strategy?.inspoAccounts) ? prof.content_strategy.inspoAccounts : []);
    const preferredGender = (prof?.preferred_gender || prof?.content_strategy?.preferredGender || 'any').toLowerCase();

    const usernames = Array.from(new Set([
      ...inspo.map(s => String(s).replace('@','')),
      ...inspo.map(s => String(s).startsWith('@') ? String(s).slice(1) : String(s))
    ])).filter(Boolean);

    const since = new Date(Date.now() - windowDays*24*3600*1000).toISOString();

    // Posts within window
    const { data: posts } = await db.client
      .from('posts')
      .select('post_id, username, engagement_rate, created_at')
      .in('username', usernames)
      .gte('created_at', since)
      .order('engagement_rate', { ascending: false })
      .limit(500);
    const postIds = Array.from(new Set((posts||[]).map(p => p.post_id)));

    // Images with embeddings for those posts
    let imgCount = 0;
    let imgSample = [];
    if (postIds.length) {
      const { data: imgs } = await db.client
        .from('images')
        .select('id, username, embedding')
        .in('post_id', postIds)
        .not('embedding', 'is', null)
        .limit(20);
      imgCount = (imgs||[]).length;
      imgSample = (imgs||[]).slice(0,5).map(r => ({ id: r.id, username: r.username, hasEmbedding: Array.isArray(r.embedding) }));
    }

    // Gender usernames filter
    let genderNames = [];
    if (preferredGender === 'men' || preferredGender === 'women') {
      const { data: g } = await db.client
        .from('accounts')
        .select('username')
        .eq('gender', preferredGender);
      genderNames = (g||[]).map(r => r.username);
    }

    res.json({
      username,
      windowDays,
      preferredGender,
      inspoResolved: usernames,
      postsFound: (posts||[]).length,
      postIdsSample: postIds.slice(0,5),
      imagesWithEmbeddings: imgCount,
      imageSample: imgSample,
      genderMatchedSources: genderNames.length,
      genderSample: genderNames.slice(0,10)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


