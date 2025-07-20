import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Initialize database connection
    const db = new SupabaseClient();
    
    if (req.method === 'GET') {
      const { data: profiles, error } = await db.client
        .from('account_profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching account profiles:', error);
        return res.status(500).json({ error: 'Failed to fetch account profiles' });
      }

      res.status(200).json(profiles || []);
    } else if (req.method === 'POST') {
      const { username, displayName, platform, accountType, targetAudience, contentStrategy, performanceGoals, postingSchedule } = req.body;
      
      if (!username || !displayName) {
        return res.status(400).json({ error: 'Username and display name are required' });
      }
      
      const { data, error } = await db.client
        .from('account_profiles')
        .upsert({
          username,
          display_name: displayName,
          platform,
          account_type: accountType,
          target_audience: targetAudience,
          content_strategy: contentStrategy,
          performance_goals: performanceGoals,
          posting_schedule: postingSchedule,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ 
            error: 'Profile already exists',
            message: `An active profile for "${username}" already exists.`
          });
        }
        throw error;
      }
      
      res.status(200).json(data);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Account profiles endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
} 