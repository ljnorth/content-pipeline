// Minimal test to see if anything works in Vercel

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    message: 'Test endpoint working',
    method: req.method,
    url: req.url,
    query: req.query
  });
}