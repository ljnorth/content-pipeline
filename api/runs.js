import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res){
  try{
    const db = new SupabaseClient();
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 200);
    const jt = req.query.job_type || null;
    const st = req.query.status || null;
    let q = db.client
      .from('job_runs')
      .select('run_id, job_type, idempotency_key, status, attempt, max_attempts, created_at, started_at, ended_at, error_excerpt, metrics')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (jt) q = q.eq('job_type', jt);
    if (st) q = q.eq('status', st);
    const { data, error } = await q;
    if (error) throw error;
    if ((req.headers.accept||'').includes('text/html')){
      const rows = (data||[]).map(r=>{
        const m = r.metrics ? JSON.stringify(r.metrics).slice(0,180) : '';
        return `<tr><td>${r.run_id}</td><td>${r.job_type}</td><td>${r.status}</td><td>${r.attempt}/${r.max_attempts}</td><td>${r.created_at}</td><td>${m}</td><td>${r.error_excerpt||''}</td></tr>`;
      }).join('');
      res.setHeader('Content-Type','text/html');
      return res.status(200).send(`<table border="1" cellpadding="6"><tr><th>run_id</th><th>job</th><th>status</th><th>attempts</th><th>created</th><th>metrics</th><th>error</th></tr>${rows}</table>`);
    }
    res.json({ runs: (data||[]) });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


