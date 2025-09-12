import { ContentGenerator } from '../../src/automation/content-generator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { username, count = 5 } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });

    const gen = new ContentGenerator();
    const strategy = await gen.getAccountStrategy(username);
    // Use the exact anchor-based selection the generator uses
    const runId = `influencer:${Date.now()}`;
    const result = await gen.selectWithAnchors(
      username,
      strategy,
      Math.max(1, Number(count)),
      1,
      { preview: true, runId }
    );
    const selected = Array.isArray(result?.selected) ? result.selected : [];
    const moodboards = selected.map(r => r.image_path).filter(Boolean);
    if (!moodboards.length) return res.status(404).json({ error: 'No moodboards available from generator (anchor-based)' });
    return res.json({ moodboards, selected, anchor: result.anchor, debug: result.debug });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
