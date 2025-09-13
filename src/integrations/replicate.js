import axios from 'axios';

function truncate(obj, len = 300){
  try{ const s = typeof obj === 'string' ? obj : JSON.stringify(obj); return s.length > len ? s.slice(0, len) + '…' : s; }
  catch{ return String(obj); }
}

export class ReplicateClient {
  constructor(options = {}){
    this.apiKey = options.apiKey || process.env.REPLICATE_API_TOKEN;
    this.baseUrl = (options.baseUrl || 'https://api.replicate.com').replace(/\/$/, '');
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'
    };
  }

  async runVersion(version, input){
    const url = `${this.baseUrl}/v1/predictions`;
    const body = { version, input };
    try{
      const { data } = await axios.post(url, body, { headers: this.headers });
      // Replicate with Prefer: wait returns a response with output array or a single URL
      const out = data?.output;
      if (Array.isArray(out) && out.length > 0) return out[0];
      if (typeof out === 'string') return out;
      // Some models return top-level fields
      const urlField = data?.urls?.get || data?.output_url || null;
      if (urlField) return urlField;
      throw new Error(`Replicate returned no output: ${truncate(data)}`);
    }catch(e){
      const st = e.response?.status; const resp = e.response?.data;
      throw new Error(`Replicate ${st||''} ${url} resp=${truncate(resp)}`);
    }
  }
}


