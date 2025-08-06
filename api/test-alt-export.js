// Alternative ES module export format
export function handler(req, res) {
  res.status(200).json({ 
    message: 'Alternative export works!',
    timestamp: new Date().toISOString()
  });
}

export { handler as default };