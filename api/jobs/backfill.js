import { DbQueue } from '../../src/automation/queue-db.js';
import { JobTypes } from '../../src/automation/jobs.js';

function auth(req){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return !!token && token === process.env.CRON_TOKEN;
}

function* dateRange(start, end){
  const d = new Date(start);
  const e = new Date(end);
  for (; d <= e; d.setUTCDate(d.getUTCDate()+1)) yield d.toISOString().slice(0,10);
}

export default async function handler(req, res){
  if (!auth(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { start, end, type = JobTypes.DAILY_INGEST } = req.body || {};
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  try{
    const q = new DbQueue();
    const enqueued = [];
    for (const day of dateRange(start, end)){
      const row = await q.enqueue(type, { date: day });
      enqueued.push({ day, run_id: row.run_id });
    }
    res.json({ count: enqueued.length, enqueued });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


