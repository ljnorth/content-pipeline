import { DbQueue } from '../../src/automation/queue-db.js';
import { JobTypes } from '../../src/automation/jobs.js';

function auth(req){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return !!token && token === process.env.CRON_TOKEN;
}

export default async function handler(req, res){
  if (!auth(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try{
    let { job_type = JobTypes.RUN_ONCE, payload = {}, force } = req.body || {};
    // Validate job type quickly to avoid typos
    if (!Object.values(JobTypes).includes(job_type)) return res.status(400).json({ error: 'unknown job_type' });
    if (force === true && typeof payload === 'object') payload.force = true;
    const q = new DbQueue();
    const row = await q.enqueue(job_type, payload, {});
    res.json({ run_id: row.run_id, idempotency_key: row.idempotency_key, status: row.status });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


