import { HiggsfieldClient } from '../../src/integrations/higgsfield.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { custom_reference_id, prompt, width_and_height = '1152x2048', enhance_prompt = false, quality = '1080p' } = req.body || {};
    if (!custom_reference_id) return res.status(400).json({ error: 'custom_reference_id is required' });
    const higgs = new HiggsfieldClient({});
    const created = await higgs.generateTextToImageSoul({ prompt: prompt || 'portrait photo', custom_reference_id, width_and_height, enhance_prompt, quality, batch_size: 1 });
    const jobSetId = created?.id;
    if (!jobSetId) return res.status(502).json({ error: 'text2image_soul returned no job_set id', created });
    let status = null; let url = null; const started = Date.now(); const deadline = 10 * 60 * 1000;
    while (Date.now() - started < deadline) {
      const js = await higgs.getJobSet(jobSetId);
      const jobs = Array.isArray(js?.jobs) ? js.jobs : [];
      const first = jobs[0] || null;
      status = first?.status || js?.status || null;
      if (status === 'completed') { url = first?.results?.raw?.url || first?.results?.min?.url || null; break; }
      if (status === 'failed' || status === 'nsfw') return res.status(502).json({ error: `job ${status}`, jobSetId, js });
      await new Promise(r => setTimeout(r, 3000));
    }
    if (!url) return res.status(504).json({ error: 'timed out waiting for job-set', jobSetId, status });
    return res.status(200).json({ jobSetId, status: 'completed', url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


