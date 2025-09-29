export default async function handler(req, res){
  try{
    const out = {
      node: process.version,
      has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      has_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE),
      has_ANON: Boolean(process.env.SUPABASE_ANON_KEY)
    };
    try{
      const { SupabaseClient } = await import('../../src/database/supabase-client.js');
      const db = new SupabaseClient();
      out.client_ok = true;
      try{
        const { count, error } = await db.client.from('jobs').select('*', { count: 'exact', head: true });
        out.jobs_count_head_ok = !error;
        out.jobs_count = count ?? null;
      }catch(e){ out.jobs_count_head_ok = false; out.jobs_count_error = e.message; }
    }catch(e){ out.client_ok = false; out.client_error = e.message; }
    res.json(out);
  }catch(e){ res.status(500).json({ error: e.message }); }
}


