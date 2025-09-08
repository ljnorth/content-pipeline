import { GeminiClient } from '../src/integrations/gemini.js';

export default async function handler(req, res){
  try{
    const { prompt, imageUrl } = req.method === 'POST' ? req.body || {} : req.query;
    const gemini = new GeminiClient();
    let out;
    if (imageUrl){
      out = await gemini.generateFromImagesAndPrompt({ images: [{ url: imageUrl, mimeType: 'image/jpeg' }], prompt: prompt || 'High-quality image' });
    } else {
      out = await gemini.generateFromPrompt({ prompt: prompt || 'High-quality image' });
    }
    return res.json({ success: true, mimeType: out.mimeType, base64: out.base64 });
  }catch(e){
    return res.status(500).json({ success: false, error: e.message });
  }
}


