// dynamic imports inside handler to avoid top-level crashes in restricted runtimes

export default async function handler(req,res){
  try{
    if (req.method !== 'POST') { res.setHeader('Allow',['POST']); return res.status(405).json({ error:'Method not allowed' }); }
    const { username, image_url=null, caption_override=null, audio_id=null, allow_silent=false, debug=false, mode='inline' } = req.body||{};
    const logs = [];
    const log = (step, data) => { try{ logs.push({ step, data }); }catch(_){} };
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    log('init', { node: process.version, platform: process.platform, arch: process.arch, ffmpegPathEnv: process.env.FFMPEG_PATH||null, tempDirEnv: process.env.TEMP_DIR||null });
    if (!username) return res.status(400).json({ error:'username required' });

    // If user requests render offload, enqueue a job instead
    if (mode === 'render'){
      try {
        const { SupabaseClient } = await import('../../src/database/supabase-client.js');
        const db = new SupabaseClient();
        const payload = { action: 'meme_single', allow_silent: Boolean(allow_silent), image_url: image_url||null, caption_override: caption_override||null, audio_id: audio_id||null };
        const { data, error } = await db.client.from('jobs').insert({ username, payload, status: 'queued' }).select('id').single();
        if (error) return res.status(500).json({ error: error.message, logs });
        return res.status(202).json({ enqueued: true, job_id: data.id });
      } catch (e) {
        return res.status(500).json({ error: e.message, where: 'meme-single-enqueue', logs });
      }
    }

    // Inline path (serverless attempt)
    let SupabaseClient, generateMemeCopy, VideoGenerator, isFashionNoTextImage;
    try {
      ({ SupabaseClient } = await import('../../src/database/supabase-client.js'));
      ({ generateMemeCopy } = await import('../../src/automation/meme.js'));
      ({ VideoGenerator } = await import('../../src/utils/video-generator.js'));
      ({ isFashionNoTextImage } = await import('../../src/utils/vision.js'));
      log('imports_loaded', { ok: true });
    } catch (impErr) {
      log('imports_failed', { message: impErr?.message||String(impErr) });
      return res.status(500).json({ error: `module load failed: ${impErr?.message||'unknown'}`, where: 'meme-single', logs });
    }

    const db = new SupabaseClient();

    // Load profile
    const { data: profile } = await db.client.from('account_profiles').select('*').eq('username', username).single();
    if (!profile) { log('profile_missing', { username }); return res.status(404).json({ error:'account profile not found', logs }); }

    // 1) Pick or validate image (from recent DB to avoid heavy gen)
    let imgUrl = image_url;
    let aesthetic = null;
    if (!imgUrl){
      const { data: recents, error: recErr } = await db.client
        .from('images')
        .select('image_path,imagePath,aesthetic,created_at')
        .eq('username', username)
        .order('created_at', { ascending: false })
        .limit(50);
      if (recErr) { log('images_fetch_error', { message: recErr.message }); return res.status(500).json({ error:'failed to fetch candidate images', logs }); }
      const candidates = (recents||[])
        .map(i => ({ url: i.image_path || i.imagePath, aesthetic: i.aesthetic || null }))
        .filter(c => !!c.url)
        .sort(()=> Math.random()-0.5);
      log('image_candidates', { count: candidates.length });
      if (!candidates.length) { log('no_images', {}); return res.status(400).json({ error:'no images available for meme', logs }); }
      let checks = 0;
      for (const c of candidates){
        if (checks >= 8) break;
        checks += 1;
        const pass = await isFashionNoTextImage(c.url);
        log('vision_check', { url: c.url, pass });
        if (pass){ imgUrl = c.url; aesthetic = c.aesthetic || null; break; }
      }
      if (!imgUrl) { log('vision_gate_failed_all', { checked: checks }); return res.status(400).json({ error:'no suitable image passed vision gate', logs }); }
    }
    if (!imgUrl) return res.status(400).json({ error:'image_url required', logs });
    if (image_url){
      const ok = await isFashionNoTextImage(imgUrl);
      if (!ok) { log('vision_gate_reject_supplied', { image_url }); return res.status(400).json({ error:'image rejected by vision gate (not clothing or has text)', logs }); }
    }
    log('image_selected', { imgUrl, aesthetic });

    // 2) Meme copy
    let copy; try { copy = caption_override || (await generateMemeCopy({ username, profile, aesthetic })).text; }
    catch(_) { copy = caption_override || 'fall outfit inspo'; }
    log('copy', { copy });

    // 3) Audio
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

    // 4) Compose
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

    // Upload
    let videoUrl = out.videoUrl || out.url || null;
    try {
      if (!videoUrl && out.buffer) {
        const { SupabaseStorage } = await import('../../src/utils/supabase-storage.js');
        const store = new SupabaseStorage();
        const up = await store.uploadBuffer(out.buffer, String(username).replace('@',''), 'videos/meme', out.filename || `meme_${Date.now()}.mp4`, 'character-outputs', 'video/mp4');
        videoUrl = up.publicUrl;
      }
    } catch(uploadErr) { log('upload_failed', { message: uploadErr?.message||String(uploadErr) }); }
    log('upload', { videoUrl: videoUrl || null });

    // Save row
    const { data: recIns, error: recErr } = await db.client.from('generated_videos').insert({ username, kind: 'meme_single', image_id: null, audio_id: audio?.id || null, template_id: null, video_url: videoUrl, duration_sec: 8, copy_text: copy }).select('id').single();
    if (recErr) log('save_failed', { message: recErr.message });

    return res.status(200).json({ success: true, video: { ...out, videoUrl }, caption: copy, ...(debug? { logs } : {}) });
  }catch(e){ return res.status(500).json({ error: e.message, where: 'meme-single', hint: 'enable debug=true for logs', stack: e?.stack, logs: [{ step:'caught', data: e.message }] }); }
}


