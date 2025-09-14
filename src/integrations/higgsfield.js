import fetch from 'node-fetch';

export class HiggsfieldClient {
  constructor(options = {}){
    // Platform API only (hf-api-key + hf-secret headers)
    this.keyId = options.keyId || process.env.HF_API_KEY || process.env['hf-api-key'] || process.env.HIGGSFIELD_API_KEY_ID || process.env.HIGGSFIELD_API_KEY;
    this.secret = options.secret || process.env.HF_SECRET || process.env['hf-secret'] || process.env.HIGGSFIELD_API_SECRET;
    const rawBase = process.env.HIGGSFIELD_PLATFORM_API_BASE;
    if (!this.keyId || !this.secret || !rawBase){
      throw new Error('hf-api-key, hf-secret, and HIGGSFIELD_PLATFORM_API_BASE are required');
    }
    // Normalize: drop trailing slash; convert '/api/v1' -> '/v1'
    let base = rawBase.replace(/\/+$/, '');
    base = base.replace(/\/api\/v(\d+)$/, '/v$1');
    this.baseUrl = base;
    this.mode = 'platform';
    this.headersPost = { 'hf-api-key': this.keyId, 'hf-secret': this.secret, 'Content-Type': 'application/json' };
    this.headersGet = { 'hf-api-key': this.keyId, 'hf-secret': this.secret };
    this.model = options.model || process.env.HIGGSFIELD_MODEL || 'seedance pro';
    this.motionId = options.motionId || process.env.HIGGSFIELD_MOTION_ID || undefined;
    this.enhancePrompt = (String(options.enhance_prompt ?? process.env.HIGGSFIELD_ENHANCE_PROMPT ?? 'true').toLowerCase() === 'true');
  }

  async createSoul({ name = 'influencer', images = [] }){
    if (this.mode !== 'platform') throw new Error('createSoul requires Platform API credentials');
    // Platform: POST /custom-references with input_images [{ type, image_url }]
    const body = JSON.stringify({ name, input_images: images.map(u => ({ type: 'url', image_url: u })) });
    const res = await fetch(`${this.baseUrl}/custom-references`, { method: 'POST', headers: this.headersPost, body });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(`Higgsfield ${res.status} ${res.statusText}: ${text || 'no body'}`);
    }
    return await res.json();
  }

  async getCustomReference(id){
    if (this.mode !== 'platform') throw new Error('getCustomReference requires Platform API credentials');
    const res = await fetch(`${this.baseUrl}/custom-references/${encodeURIComponent(id)}`, { headers: this.headersGet });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(`Higgsfield GET ${res.status} ${res.statusText}: ${text || 'no body'}`);
    }
    return await res.json();
  }

  async generateImageFromSoul({ soul_id, prompt, aspect_ratio = '3:4', resolution = '1080p' }){
    const body = JSON.stringify({ soul_id, prompt, aspect_ratio, resolution });
    const res = await fetch(`${this.baseUrl}/images`, { method: 'POST', headers: this.headersPost, body });
    if (!res.ok) { const text = await res.text().catch(()=> ''); throw new Error(`Higgsfield ${res.status} ${res.statusText}: ${text||'no body'}`); }
    return await res.json();
  }

  async generateTextToVideo({ prompt, duration = 8, resolution = '1080p', aspect_ratio = '9:16', seed }){
    // Not used in current flow for platform; keep placeholder if needed later
    throw new Error('Higgsfield Platform T2V not implemented');
  }

  async generateImageToVideo({ prompt, image_url, duration = 8, resolution = '1080p', aspect_ratio = '9:16', camera_fixed = false, seed }){
    const body = JSON.stringify({ prompt, image_url, duration, resolution, aspect_ratio, model: this.model, motion_id: this.motionId, enhance_prompt: this.enhancePrompt, seed });
    const res = await fetch(`${this.baseUrl}/image2video`, { method: 'POST', headers: this.headersPost, body });
    if (!res.ok) { const text = await res.text().catch(()=> ''); throw new Error(`Higgsfield ${res.status} ${res.statusText}: ${text||'no body'}`); }
    return await res.json();
  }

  async getStatus(generation_id){
    const res = await fetch(`${this.baseUrl}/status/${encodeURIComponent(generation_id)}`, { headers: this.headersGet });
    if (!res.ok) { const text = await res.text().catch(()=> ''); throw new Error(`Higgsfield GET ${res.status} ${res.statusText}: ${text||'no body'}`); }
    return await res.json();
  }

  async getJobSet(jobSetId){
    const res = await fetch(`${this.baseUrl}/job-sets/${encodeURIComponent(jobSetId)}`, { headers: this.headersGet });
    if (!res.ok) { const text = await res.text().catch(()=> ''); throw new Error(`Higgsfield GET ${res.status} ${res.statusText}: ${text||'no body'}`); }
    return await res.json();
  }
}


