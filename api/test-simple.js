export default async function handler(req, res) {
  res.json({
    success: true,
    message: 'Simple test API working',
    timestamp: new Date().toISOString()
  });
} 