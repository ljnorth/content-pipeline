import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default async function handler(req, res) {
  try {
    const imageCount = Math.max(1, Math.min(12, Number(req.body?.imageCount) || 10));
    const { data: rows, error } = await supabase
      .from('images')
      .select('*')
      .limit(5000);
    if (error) throw error;

    const selected = pickRandom(rows || [], imageCount).map((img, idx) => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path,
      aesthetic: img.aesthetic || 'mixed',
      is_cover_slide: idx === 0
    }));

    const post = {
      id: `temp_${Date.now()}`,
      postNumber: 1,
      images: selected,
      caption: 'Random inspiration ✨',
      created_at: new Date().toISOString(),
      is_temporary: true
    };

    res.json({ success: true, post });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}


