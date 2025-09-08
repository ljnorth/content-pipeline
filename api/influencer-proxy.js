import fetch from 'node-fetch';

const base = process.env.INFLUENCER_API_BASE;

export default async function handler(req, res){
  if (!base) return res.status(500).json({ error: 'INFLUENCER_API_BASE not set' });
  try{
    if (req.method === 'POST' && req.url.startsWith('/api/influencer/run')){
      const r = await fetch(base + '/v1/influencer/run', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(req.body||{}) });
      const j = await r.json(); return res.status(r.status).json(j);
    }
    if (req.method === 'GET' && req.url.startsWith('/api/influencer/status')){
      const job_id = req.query.job_id; const r = await fetch(base + '/v1/influencer/status/' + encodeURIComponent(job_id));
      const j = await r.json(); return res.status(r.status).json(j);
    }
    if (req.method === 'POST' && req.url.startsWith('/api/influencer/video')){
      const { asset_id } = req.body || {}; const r = await fetch(base + '/v1/influencer/video/' + encodeURIComponent(asset_id), { method:'POST' });
      const j = await r.json(); return res.status(r.status).json(j);
    }
    res.setHeader('Allow', 'POST,GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }catch(e){ return res.status(500).json({ error: e.message }); }
}
