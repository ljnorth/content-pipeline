import axios from 'axios';

export class HeygenClient {
  constructor(options = {}){
    this.apiKey = options.apiKey || process.env.HEYGEN_API_KEY;
    this.baseUrl = options.baseUrl || 'https://api.heygen.com/v2';
    this.headers = { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' };
  }

  async generateVideo({ avatar_id, input_text, voice_id, width = 1080, height = 1920, background = { type:'color', value:'#000000' } }){
    const body = {
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id, avatar_style: 'normal' },
          voice: { type: 'text', input_text, voice_id },
          background
        }
      ],
      dimension: { width, height }
    };
    const { data } = await axios.post(`${this.baseUrl}/video/generate`, body, { headers: this.headers });
    return data;
  }

  async getVideoStatusV1(video_id){
    const { data } = await axios.get(`https://api.heygen.com/v1/video_status.get`, { params: { video_id }, headers: { 'X-API-KEY': this.apiKey } });
    return data;
  }

  async generateFromTemplate({ template_id, title, variables }){
    const { data } = await axios.post(`${this.baseUrl}/template/${encodeURIComponent(template_id)}/generate`, { title, variables }, { headers: this.headers });
    return data;
  }
}


