import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res){
  try{
    const db = new SupabaseClient();
    const { data, error } = await db.client
      .from('job_runs')
      .select('run_id, job_type, idempotency_key, status, attempt, max_attempts, created_at, started_at, ended_at, error_excerpt')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    if ((req.headers.accept||'').includes('text/html')){
      const rows = (data||[]).map(r=>`<tr><td>${r.run_id}</td><td>${r.job_type}</td><td>${r.status}</td><td>${r.attempt}/${r.max_attempts}</td><td>${r.created_at}</td><td>${r.error_excerpt||''}</td></tr>`).join('');
      res.setHeader('Content-Type','text/html');
      return res.status(200).send(`<table border="1" cellpadding="6"><tr><th>run_id</th><th>job</th><th>status</th><th>attempts</th><th>created</th><th>error</th></tr>${rows}</table>`);
    }
    res.json({ runs: data||[] });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


