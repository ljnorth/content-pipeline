import { SupabaseClient } from '../../src/database/supabase-client.js';
import { generateMemeCopy } from '../../src/automation/meme.js';
import { VideoGenerator } from '../../src/utils/video-generator.js';
import { isFashionNoTextImage } from '../../src/utils/vision.js';

export default async function handler(req,res){
  try{
    if (req.method !== 'POST') { res.setHeader('Allow',['POST']); return res.status(405).json({ error:'Method not allowed' }); }
    const { username, image_url=null, caption_override=null, audio_id=null } = req.body||{};
    if (!username) return res.status(400).json({ error:'username required' });
    const db = new SupabaseClient();

    // Load profile
    const { data: profile } = await db.client.from('account_profiles').select('*').eq('username', username).single();
    if (!profile) return res.status(404).json({ error:'account profile not found' });

    // 1) Pick or validate image (anchor-driven selection)
    let imgUrl = image_url;
    let aesthetic = null;
    if (!imgUrl){
      const { ContentGenerator } = await import('../../src/automation/content-generator.js');
      const gen = new ContentGenerator();
      const post = await gen.generateSinglePost({ username }, profile, 1, { preview: true, runId: 'meme_'+Date.now() });
      const picked = (post.images||[])[0];
      if (!picked) return res.status(400).json({ error:'no image selected' });
      imgUrl = picked.imagePath || picked.image_path;
      aesthetic = picked.aesthetic || null;
    }
    if (!imgUrl) return res.status(400).json({ error:'image_url required' });
    const ok = await isFashionNoTextImage(imgUrl);
    if (!ok) return res.status(400).json({ error:'image rejected by vision gate (not clothing or has text)' });

    // 2) Generate meme copy
    const copy = caption_override || (await generateMemeCopy({ username, profile, aesthetic })).text;

    // 3) Pick audio
    let audio = null;
    if (audio_id){
      const { data: a } = await db.client.from('meme_audio').select('*').eq('id', audio_id).single();
      audio = a || null;
    } else {
      const g = (['male','female'].includes(profile?.target_audience?.gender)) ? profile.target_audience.gender : 'both';
      const pref = ['both', g];
      const { data } = await db.client.from('meme_audio').select('*').in('gender', pref).limit(1000);
      const pool = (data||[]).filter(x => (x.duration_sec||8) >= 8);
      if (!pool.length) return res.status(400).json({ error:'no meme audio available' });
      audio = pool[Math.floor(Math.random()*pool.length)];
    }

    // 4) Compose video
    const vg = new VideoGenerator();
    const out = await vg.createMemeClipSingleImage({
      imageUrl: imgUrl,
      caption: copy,
      audioUrl: audio.url,
      width: 1080, height: 1920, fps: 30,
      duration: 8, fadeSec: 2,
      fontFile: process.env.MEME_FONT_FILE || 'public/assets/Inter-Bold.ttf',
      watermark: username.startsWith('@') ? username : '@'+username
    });

    // 5) Save record
    await db.client.from('generated_videos').insert({
      username, kind: 'meme_single', image_id: null, audio_id: audio.id, template_id: null,
      video_url: out.videoUrl || out.url || null, duration_sec: 8, copy_text: copy
    });

    return res.status(200).json({ success: true, video: out, caption: copy });
  }catch(e){ return res.status(500).json({ error: e.message }); }
}


