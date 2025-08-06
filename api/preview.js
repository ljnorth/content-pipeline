// Simple test version to debug Vercel issues

export default async function handler(req, res) {
  const { username, batchId } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Simple HTML response to test if basic routing works
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Preview - @${username}</title>
</head>
<body>
    <h1>Preview Test</h1>
    <p>Username: ${username}</p>
    <p>BatchId: ${batchId || 'none'}</p>
    <p>If you see this, the routing is working!</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}