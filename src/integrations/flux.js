import axios from 'axios';

function truncate(obj, len = 300){
  try{ const s = typeof obj === 'string' ? obj : JSON.stringify(obj); return s.length > len ? s.slice(0, len) + '…' : s; }
  catch{ return String(obj); }
}

export class FluxClient {
  constructor(options = {}){
    this.baseUrl = options.baseUrl || process.env.FLUX_API_BASE || 'https://api.bfl.ai';
    this.apiKey = options.apiKey || process.env.FLUX_PRO_API_KEY || '';
    // BFL uses x-key header
    this.headers = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'x-key': this.apiKey
    };
    this.t2iPath = options.t2iPath || process.env.FLUX_T2I_PATH || '/v1/flux-pro-1.1';
    this.i2iPath = options.i2iPath || process.env.FLUX_I2I_PATH || '/v1/flux-pro-1.1';
    this.maxPollMs = options.maxPollMs || 120000;
    this.pollIntervalMs = options.pollIntervalMs || 1000;
  }

  async postAndPoll(path, body){
    const url = `${this.baseUrl}${path}`;
    let req;
    try{
      req = await axios.post(url, body, { headers: this.headers });
    }catch(e){
      const st = e.response?.status; const data = e.response?.data;
      throw new Error(`FLUX POST ${st||''} @ ${url} body=${truncate(body)} resp=${truncate(data)}`);
    }
    const initial = req.data || {};
    const pollingUrl = initial.polling_url || initial.url || null;
    if (!pollingUrl){
      // Some providers return result inline
      return initial;
    }
    const t0 = Date.now();
    while (Date.now() - t0 < this.maxPollMs){
      let res;
      try{ res = await axios.get(pollingUrl, { headers: this.headers }); }
      catch(e){
        const st = e.response?.status; const data = e.response?.data;
        throw new Error(`FLUX POLL ${st||''} @ ${pollingUrl} resp=${truncate(data)}`);
      }
      const d = res.data || {};
      const status = d.status || d.state || d.stage || '';
      if (status.toLowerCase() === 'ready' || status.toLowerCase() === 'succeeded' || d.result){
        return d.result || d;
      }
      if (status.toLowerCase() === 'error' || status.toLowerCase() === 'failed'){
        throw new Error(`FLUX job failed @ ${pollingUrl} resp=${truncate(d)}`);
      }
      await new Promise(r => setTimeout(r, this.pollIntervalMs));
    }
    throw new Error(`FLUX poll timeout @ ${pollingUrl}`);
  }

  // Text to image using provider task endpoint (e.g., /v1/flux-pro-1.1)
  async textToImage({ prompt, negative = '', seed = undefined, guidance = undefined, aspect_ratio = '1:1' }){
    const body = { prompt, negative, seed, guidance, aspect_ratio };
    const out = await this.postAndPoll(this.t2iPath, body);
    const url = out?.sample || out?.url || out?.image_url || out?.images?.[0]?.url || null;
    if (!url) throw new Error(`FLUX T2I returned no url: ${truncate(out)}`);
    return { url };
  }

  // Image to image: same endpoint with input_image
  async imageToImage({ image_url, prompt, negative = '', strength = 0.35, seed = undefined, guidance = undefined, aspect_ratio = '1:1' }){
    const body = { prompt, negative, seed, guidance, aspect_ratio, input_image: image_url, strength };
    const out = await this.postAndPoll(this.i2iPath, body);
    const url = out?.sample || out?.url || out?.image_url || out?.images?.[0]?.url || null;
    if (!url) throw new Error(`FLUX I2I returned no url: ${truncate(out)}`);
    return { url };
  }
}
