import axios from 'axios';

export class HiggsfieldClient {
  constructor(options = {}){
    // Prefer Platform API (key_id + secret)
    this.keyId = options.keyId || process.env.HIGGSFIELD_API_KEY_ID;
    this.secret = options.secret || process.env.HIGGSFIELD_API_SECRET;
    this.apiKey = options.apiKey || process.env.HIGGSFIELD_API_KEY; // legacy

    if (this.keyId && this.secret) {
      this.mode = 'platform';
      this.baseUrl = (options.baseUrl || process.env.HIGGSFIELD_PLATFORM_API_BASE || 'https://platform.higgsfield.ai/v1').replace(/\/$/, '');
      const creds = Buffer.from(`${this.keyId}:${this.secret}`).toString('base64');
      this.headers = { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' };
      this.model = options.model || process.env.HIGGSFIELD_MODEL || 'seedance pro';
      this.motionId = options.motionId || process.env.HIGGSFIELD_MOTION_ID || undefined;
      this.enhancePrompt = (String(options.enhance_prompt ?? process.env.HIGGSFIELD_ENHANCE_PROMPT ?? 'true').toLowerCase() === 'true');
    } else {
      this.mode = 'legacy';
      this.baseUrl = (options.baseUrl || process.env.HIGGSFIELD_BASE || 'https://higgsfieldapi.com/api/v1').replace(/\/$/, '');
      this.headers = { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
    }
  }

  async createSoul({ name = 'influencer', images = [] }){
    if (this.mode !== 'platform') throw new Error('createSoul requires Platform API credentials');
    const body = { name, images: images.map(u => ({ url: u })) };
    const { data } = await axios.post(`${this.baseUrl}/souls`, body, { headers: this.headers });
    return data; // expect { soul_id }
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


