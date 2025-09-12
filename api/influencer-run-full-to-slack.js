// Alias for Vercel to ensure the function is detected even if nested paths are missed
// Lazy-import the heavy handler so GET can return 405 without bundling errors
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const mod = await import('./influencer/run-full-to-slack.js');
    return mod.default(req, res);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'internal error' });
  }
}


