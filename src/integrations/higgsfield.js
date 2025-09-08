import axios from 'axios';

export class HiggsfieldClient {
  constructor(options = {}){
    this.apiKey = options.apiKey || process.env.HIGGSFIELD_API_KEY;
    this.baseUrl = options.baseUrl || process.env.HIGGSFIELD_BASE || 'https://higgsfieldapi.com/api/v1';
    this.headers = { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
  }

  async generateTextToVideo({ prompt, duration = 8, resolution = '1080p', aspect_ratio = '9:16', seed }){
    const body = { type: 'text-to-video', prompt, duration, resolution, aspect_ratio, seed };
    const { data } = await axios.post(`${this.baseUrl}/generate`, body, { headers: this.headers });
    return data;
  }

  async generateImageToVideo({ prompt, image_url, duration = 8, resolution = '1080p', aspect_ratio = '9:16', camera_fixed = false, seed }){
    const body = { type: 'image-to-video', prompt, image_url, duration, resolution, aspect_ratio, camera_fixed, seed };
    const { data } = await axios.post(`${this.baseUrl}/generate`, body, { headers: this.headers });
    return data;
  }

  async getStatus(generation_id){
    const { data } = await axios.get(`${this.baseUrl}/status/${encodeURIComponent(generation_id)}`, { headers: this.headers });
    return data;
  }
}


