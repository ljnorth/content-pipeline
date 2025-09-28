import { SupabaseClient } from '../../src/database/supabase-client.js';
import { generateMemeCopy } from '../../src/automation/meme.js';
import { VideoGenerator } from '../../src/utils/video-generator.js';
import { isFashionNoTextImage } from '../../src/utils/vision.js';

export default async function handler(req,res){
  try{
    if (req.method !== 'POST') { res.setHeader('Allow',['POST']); return res.status(405).json({ error:'Method not allowed' }); }
    const { username, image_url=null, caption_override=null, audio_id=null, allow_silent=false, debug=false } = req.body||{};
    const logs = [];
    const log = (step, data) => { try{ logs.push({ step, data }); }catch(_){} };
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if (!username) return res.status(400).json({ error:'username required' });
    const db = new SupabaseClient();

    // Load profile
    const { data: profile } = await db.client.from('account_profiles').select('*').eq('username', username).single();
    if (!profile) { log('profile_missing', { username }); return res.status(404).json({ error:'account profile not found', logs }); }

    // 1) Pick or validate image (anchor-driven selection)
    let imgUrl = image_url;
    let aesthetic = null;
    if (!imgUrl){
      const { ContentGenerator } = await import('../../src/automation/content-generator.js');
      const gen = new ContentGenerator();
      const post = await gen.generateSinglePost({ username }, profile, 1, { preview: true, runId: 'meme_'+Date.now() });
      const imgs = Array.isArray(post?.images) ? post.images : [];
      if (!imgs.length) { log('no_images', {}); return res.status(400).json({ error:'no images available for meme', logs }); }
      // random order then pick the first that passes vision gate
      for (const i of imgs.sort(()=> Math.random()-0.5)){
        const url = i.imagePath || i.image_path; if (!url) continue;
        const pass = await isFashionNoTextImage(url);
        if (pass){ imgUrl = url; aesthetic = i.aesthetic || null; break; }
      }
      if (!imgUrl) { log('vision_gate_failed_all', {}); return res.status(400).json({ error:'no suitable image passed vision gate', logs }); }
    }
    if (!imgUrl) return res.status(400).json({ error:'image_url required', logs });
    // If user supplied an image_url, still gate it
    if (image_url){
      const ok = await isFashionNoTextImage(imgUrl);
      if (!ok) { log('vision_gate_reject_supplied', { image_url }); return res.status(400).json({ error:'image rejected by vision gate (not clothing or has text)', logs }); }
    }
    log('image_selected', { imgUrl, aesthetic });

    // 2) Generate meme copy
    let copy; try { copy = caption_override || (await generateMemeCopy({ username, profile, aesthetic })).text; }
    catch(_) { copy = caption_override || 'fall outfit inspo'; }
    log('copy', { copy });

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
      if (pool.length) audio = pool[Math.floor(Math.random()*pool.length)];
    }
    log('audio', { id: audio?.id || null, url: audio?.url || null, allow_silent });

    // 4) Compose video
    const vg = new VideoGenerator();
    const out = await vg.createMemeClipSingleImage({
      imageUrl: imgUrl,
      caption: copy,
      audioUrl: audio?.url || null,
      allowSilent: Boolean(allow_silent),
      width: 1080, height: 1920, fps: 30,
      duration: 8, fadeSec: 2,
      fontFile: process.env.MEME_FONT_FILE || 'public/assets/Inter-Bold.ttf',
      watermark: username.startsWith('@') ? username : '@'+username
    });
    log('render', { size: out?.size || null, filename: out?.filename, cmd: vg.lastCmd || null, ffmpeg_stderr: vg.lastStderr || null });

    // Upload buffer to Storage if needed for a public URL
    let videoUrl = out.videoUrl || out.url || null;
    try {
      if (!videoUrl && out.buffer) {
        const { SupabaseStorage } = await import('../../src/utils/supabase-storage.js');
        const store = new SupabaseStorage();
        const up = await store.uploadBuffer(out.buffer, String(username).replace('@',''), 'videos/meme', out.filename || `meme_${Date.now()}.mp4`, 'character-outputs', 'video/mp4');
        videoUrl = up.publicUrl;
      }
    } catch(_) {}
    log('upload', { videoUrl: videoUrl || null });

    // 5) Save record
    await db.client.from('generated_videos').insert({
      username, kind: 'meme_single', image_id: null, audio_id: audio?.id || null, template_id: null,
      video_url: videoUrl, duration_sec: 8, copy_text: copy
    });

    return res.status(200).json({ success: true, video: { ...out, videoUrl }, caption: copy, ...(debug? { logs } : {}) });
  }catch(e){ return res.status(500).json({ error: e.message, where: 'meme-single', hint: 'enable debug=true for logs', stack: e?.stack, logs: (typeof logs!== 'undefined'? logs: undefined) }); }
}


