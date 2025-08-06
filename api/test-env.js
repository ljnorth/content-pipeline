export default function handler(req, res) {
  const envCheck = {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('SUPABASE') || key.includes('VERCEL')
    )
  };
  
  res.status(200).json({ 
    message: 'Environment check',
    env: envCheck,
    timestamp: new Date().toISOString()
  });
}