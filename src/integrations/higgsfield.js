import axios from 'axios';
import fetch from 'node-fetch';

export class HiggsfieldClient {
  constructor(options = {}){
    // Prefer Platform API (hf-api-key + hf-secret headers)
    this.keyId = options.keyId || process.env['hf-api-key'] || process.env.HIGGSFIELD_API_KEY_ID || process.env.HIGGSFIELD_API_KEY;
    this.secret = options.secret || process.env['hf-secret'] || process.env.HIGGSFIELD_API_SECRET;
    this.apiKey = options.apiKey || process.env.HIGGSFIELD_API_KEY; // legacy bearer

    if (this.keyId && this.secret) {
      this.mode = 'platform';
      const rawBase = process.env.HIGGSFIELD_PLATFORM_API_BASE;
      if (!rawBase) {
        throw new Error('HIGGSFIELD_PLATFORM_API_BASE not set for platform mode');
      }
      // Normalize: drop trailing slash; convert '/api/v1' -> '/v1'
      let base = rawBase.replace(/\/+$/, '');
      base = base.replace(/\/api\/v(\d+)$/, '/v$1');
      this.baseUrl = base;
      this.headers = { 'Content-Type': 'application/json', 'hf-api-key': this.keyId, 'hf-secret': this.secret };
      this.model = options.model || process.env.HIGGSFIELD_MODEL || 'seedance pro';
      this.motionId = options.motionId || process.env.HIGGSFIELD_MOTION_ID || undefined;
      this.enhancePrompt = (String(options.enhance_prompt ?? process.env.HIGGSFIELD_ENHANCE_PROMPT ?? 'true').toLowerCase() === 'true');
    } else {
      this.mode = 'legacy';
      // Even in legacy mode, align to platform host unless explicitly overridden
      this.baseUrl = (options.baseUrl || process.env.HIGGSFIELD_BASE || 'https://platform.higgsfield.ai/v1').replace(/\/$/, '');
      this.headers = { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    }
  }

  async createSoul({ name = 'influencer', images = [] }){
    if (this.mode !== 'platform') throw new Error('createSoul requires Platform API credentials');
    // Platform: POST /custom-references with input_images [{ type, image_url }]
    const body = JSON.stringify({ name, input_images: images.map(u => ({ type: 'url', image_url: u })) });
    const res = await fetch(`${this.baseUrl}/custom-references`, { method: 'POST', headers: this.headers, body });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(`Higgsfield ${res.status} ${res.statusText}: ${text || 'no body'}`);
    }
    return await res.json();
  }

  async getCustomReference(id){
    if (this.mode !== 'platform') throw new Error('getCustomReference requires Platform API credentials');
    const res = await fetch(`${this.baseUrl}/custom-references/${encodeURIComponent(id)}`, { headers: this.headers });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error(`Higgsfield GET ${res.status} ${res.statusText}: ${text || 'no body'}`);
    }
    return await res.json();
  }

  async generateImageFromSoul({ soul_id, prompt, aspect_ratio = '3:4', resolution = '1080p' }){
    if (this.mode !== 'platform') throw new Error('generateImageFromSoul requires Platform API');
    const body = { soul_id, prompt, aspect_ratio, resolution };
    const { data } = await axios.post(`${this.baseUrl}/images`, body, { headers: this.headers });
    return data; // expect { image_url }
  }

  async generateTextToVideo({ prompt, duration = 8, resolution = '1080p', aspect_ratio = '9:16', seed }){
    if (this.mode === 'platform') {
      throw new Error('Higgsfield Platform T2V not implemented in client');
    }
    const body = { type: 'text-to-video', prompt, duration, resolution, aspect_ratio, seed };
    const { data } = await axios.post(`${this.baseUrl}/generate`, body, { headers: this.headers });
    return data;
  }

  async generateImageToVideo({ prompt, image_url, duration = 8, resolution = '1080p', aspect_ratio = '9:16', camera_fixed = false, seed }){
    if (this.mode === 'platform') {
      const body = {
        prompt,
        image_url,
        duration,
        resolution,
        aspect_ratio,
        model: this.model,
        motion_id: this.motionId,
        enhance_prompt: this.enhancePrompt,
        seed
      };
      const { data } = await axios.post(`${this.baseUrl}/image2video`, body, { headers: this.headers });
      return data;
    }
    const body = { type: 'image-to-video', prompt, image_url, duration, resolution, aspect_ratio, camera_fixed, seed };
    const { data } = await axios.post(`${this.baseUrl}/generate`, body, { headers: this.headers });
    return data;
  }

  async getStatus(generation_id){
    const { data } = await axios.get(`${this.baseUrl}/status/${encodeURIComponent(generation_id)}`, { headers: this.headers });
    return data;
  }
}


