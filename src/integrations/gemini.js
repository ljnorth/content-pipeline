import axios from 'axios';

function toBase64(buffer){
  if (!buffer) return '';
  return Buffer.isBuffer(buffer) ? buffer.toString('base64') : Buffer.from(buffer).toString('base64');
}

async function fetchAsBase64(url){
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return toBase64(res.data);
}

export class GeminiClient {
  constructor(options = {}){
    this.apiKey = options.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com';
    this.model = options.model || 'models/gemini-2.0-flash-exp';
  }

  get endpoint(){
    return `${this.baseUrl}/v1beta/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  async generateFromPrompt({ prompt, mimeType = 'image/png' }){
    const body = {
      contents: [ { role: 'user', parts: [ { text: prompt } ] } ],
      tools: [ { image_generation: {} } ],
      generationConfig: { responseMimeType: mimeType }
    };
    const { data } = await axios.post(this.endpoint, body, { headers: { 'Content-Type': 'application/json' } });
    const part = data?.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inline_data;
    if (!inline?.data) throw new Error('Gemini image generation returned no data');
    return { mimeType: inline.mime_type || mimeType, base64: inline.data };
  }

  async generateFromImagesAndPrompt({ images = [], prompt, mimeType = 'image/png' }){
    // images: array of { url?: string, base64?: string, mimeType?: string }
    const parts = [];
    for (const img of images){
      let data = img.base64;
      if (!data && img.url){ data = await fetchAsBase64(img.url); }
      const mt = img.mimeType || 'image/jpeg';
      if (data){ parts.push({ inline_data: { mime_type: mt, data } }); }
    }
    parts.push({ text: prompt });
    const body = {
      contents: [ { role: 'user', parts } ],
      tools: [ { image_generation: {} } ],
      generationConfig: { responseMimeType: mimeType }
    };
    const { data } = await axios.post(this.endpoint, body, { headers: { 'Content-Type': 'application/json' } });
    const part = data?.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inline_data;
    if (!inline?.data) throw new Error('Gemini image generation returned no data');
    return { mimeType: inline.mime_type || mimeType, base64: inline.data };
  }
}


