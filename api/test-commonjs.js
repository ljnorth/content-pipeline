// Test with CommonJS format instead of ES modules
module.exports = (req, res) => {
  res.status(200).json({ 
    message: 'CommonJS test works!',
    timestamp: new Date().toISOString()
  });
};