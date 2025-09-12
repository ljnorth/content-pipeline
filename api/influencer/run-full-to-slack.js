export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, moodboardCount = 5, outputs } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });

    const INFLUENCER_API_BASE = process.env.INFLUENCER_API_BASE;
    const CONTENT_PIPELINE_API_BASE = process.env.CONTENT_PIPELINE_API_BASE;
    if (!INFLUENCER_API_BASE) return res.status(500).json({ error: 'INFLUENCER_API_BASE not set' });
    if (!CONTENT_PIPELINE_API_BASE) return res.status(500).json({ error: 'CONTENT_PIPELINE_API_BASE not set' });

    // 1) Get moodboards from embeddings-based content pipeline
    const ep = `${CONTENT_PIPELINE_API_BASE.replace(/\/$/, '')}/api/posts/by-embeddings`;
    const pr = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, limit: Math.max(1, Number(moodboardCount)) })
    });
    const pj = await pr.json().catch(() => ({}));
    if (!pr.ok) return res.status(pr.status).json({ error: pj.error || 'content pipeline failed' });
    let moodboards = [];
    if (Array.isArray(pj.moodboards)) {
      moodboards = pj.moodboards.map(m => (typeof m === 'string' ? m : (m.image_url || m.url))).filter(Boolean);
    }
    if (!moodboards.length && Array.isArray(pj.posts)) {
      for (const post of pj.posts) {
        const imgs = post.images || post.image_urls || [];
        for (const u of imgs) { if (moodboards.length < moodboardCount) moodboards.push(u); }
        if (moodboards.length >= moodboardCount) break;
      }
    }
    if (!moodboards.length) return res.status(404).json({ error: 'No moodboards returned by content pipeline' });

    // 2) Kick off influencer run (persona optional)
    const ir = await fetch(`${INFLUENCER_API_BASE.replace(/\/$/, '')}/run-full-to-slack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, moodboards, outputs })
    });
    const ij = await ir.json().catch(() => ({ error: 'invalid json from influencer api' }));
    if (!ir.ok) return res.status(ir.status).json(ij);
    return res.status(200).json({ success: true, ...ij });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


