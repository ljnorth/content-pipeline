import { SupabaseClient } from '../../src/database/supabase-client.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const q = req.query || {};
    const job_id = q.job_id || q.id;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });
    const db = new SupabaseClient();
    const { data: job, error: je } = await db.client
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();
    if (je) return res.status(404).json({ error: 'job not found' });
    const { data: assets } = await db.client
      .from('job_assets')
      .select('*')
      .eq('job_id', job_id)
      .order('id', { ascending: true });
    return res.status(200).json({
      job_id,
      status: job.status,
      step: job.step,
      retries: job.retries,
      error: job.error,
      started_at: job.started_at,
      finished_at: job.finished_at,
      assets: assets || []
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


