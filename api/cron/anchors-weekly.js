import { DbQueue } from '../../src/automation/queue-db.js';
import { JobTypes } from '../../src/automation/jobs.js';

function isCron(req){ return req.headers['x-vercel-cron'] === '1'; }
function isAuthorized(req){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query?.token || null);
  return !!token && token === process.env.CRON_TOKEN;
}

export default async function handler(req, res){
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!isCron(req) && !isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try{
    const q = new DbQueue();
    const row = await q.enqueue(JobTypes.ANCHORS_RECALIBRATE_WEEKLY, { force: true }, {});
    res.json({ enqueued: true, run_id: row.run_id });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


