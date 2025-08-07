import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageIds = [], allImageIds = [] } = req.body || {};
    const count = imageIds.length || 1;

    const { data: rows, error } = await supabase
      .from('images')
      .select('*')
      .limit(5000);
    if (error) throw error;

    const exclude = new Set(allImageIds);
    const candidates = (rows || []).filter(r => !exclude.has(r.id));
    const selected = pickRandom(candidates, count).map(img => ({
      id: img.id,
      imagePath: img.image_path,
      image_path: img.image_path,
      aesthetic: img.aesthetic || 'mixed',
      is_cover_slide: false
    }));

    res.json({ success: true, newImages: selected });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}


