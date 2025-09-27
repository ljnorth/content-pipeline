import OpenAI from 'openai';

export async function isClothingImage(imageUrl) {
  try {
    if (!process.env.OPENAI_API_KEY) return true; // no key → skip gating
    if (!imageUrl) return false;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `You are a strict visual classifier. Answer ONLY JSON.
Return {"is_clothing":true} if this image primarily features fashion clothing or outfit imagery (single item, outfit flatlay, or a person modeling clothes).
Return {"is_clothing":false} for images primarily about nails, manicures, hair/hairstyles, makeup/beauty closeups, scenery/landscapes/beaches, or unrelated objects.
Be conservative: if unsure, return false.` },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 50,
      temperature: 0
    });
    const txt = resp.choices?.[0]?.message?.content || '{}';
    const j = JSON.parse(txt);
    return Boolean(j.is_clothing);
  } catch (_) {
    return true; // fail-open to avoid blocking
  }
}


