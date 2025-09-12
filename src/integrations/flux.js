import axios from 'axios';

export class FluxClient {
  constructor(options = {}){
    this.baseUrl = options.baseUrl || process.env.FLUX_API_BASE || 'https://api.flux-pro.example.com/v1';
    this.apiKey = options.apiKey || process.env.FLUX_PRO_API_KEY || '';
    this.headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
    };
  }

  async textToImage({ prompt, negative = '', seed = undefined, guidance = undefined }){
    const body = { prompt, negative, seed, guidance };
    const { data } = await axios.post(`${this.baseUrl}/text-to-image`, body, { headers: this.headers });
    // Expect { url } or { image_url }
    const url = data?.url || data?.image_url || null;
    if (!url) throw new Error('FLUX text-to-image returned no url');
    return { url };
  }

  async imageToImage({ image_url, prompt, negative = '', strength = 0.35, seed = undefined, guidance = undefined }){
    const body = { image_url, prompt, negative, strength, seed, guidance };
    const { data } = await axios.post(`${this.baseUrl}/image-to-image`, body, { headers: this.headers });
    const url = data?.url || data?.image_url || null;
    if (!url) throw new Error('FLUX image-to-image returned no url');
    return { url };
  }
}
