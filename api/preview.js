// Fixed serverless function for Vercel /preview/* routes
// This wraps the existing dynamic handler and passes username from query string

export default async function handler(req, res) {
  const { username, batchId } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Import and delegate to the existing preview handler
  const { default: previewHandler } = await import('./preview/[username].js');
  
  // Call the handler with the same structure it expects
  return previewHandler({ query: { username, batchId } }, res);
}