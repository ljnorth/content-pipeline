import OpenAI from 'openai';

async function analyzeImageForFashion(imageUrl) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `You are a strict visual classifier. Answer ONLY JSON with keys is_clothing and has_text.
Definitions:
- is_clothing: true if the image primarily features fashion clothing (single item, outfit flatlay, or a person modeling clothes). false if nails/hair/makeup/scenery/objects/quote slides.
- has_text: true if there is any overlaid text visible (words, captions, quotes, banners), even small.
Return:
{"is_clothing":true|false, "has_text":true|false}
Be conservative: when unsure, set is_clothing=false or has_text=true.` },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 80,
    temperature: 0
  });
  const txt = resp.choices?.[0]?.message?.content || '{}';
  return JSON.parse(txt);
}

export async function isClothingImage(imageUrl) {
  try {
    if (!process.env.OPENAI_API_KEY) return true; // no key → skip gating
    if (!imageUrl) return false;
    const j = await analyzeImageForFashion(imageUrl);
    return Boolean(j.is_clothing);
  } catch (_) { return true; }
}

export async function isFashionNoTextImage(imageUrl){
  try {
    if (!process.env.OPENAI_API_KEY) return true;
    if (!imageUrl) return false;
    const j = await analyzeImageForFashion(imageUrl);
    return Boolean(j.is_clothing) && !Boolean(j.has_text);
  } catch(_) { return true; }
}


