// Serverless function for Vercel to serve the preview page (both live and saved)
// It delegates to the existing instant-preview handler so we keep one source of truth.

export default async function handler(req, res) {
  const { username, batchId } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Dynamically import the existing handler that builds the HTML page
  const instantModule = await import('../instant-preview/[username].js');
  const instantHandler = instantModule.default;

  // Call it with the same req.query structure it expects
  return instantHandler({ query: { username, batchId } }, res);
}
