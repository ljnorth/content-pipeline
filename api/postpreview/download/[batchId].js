import { SupabaseClient } from '../../../src/database/supabase-client.js';

export default async function handler(req, res) {
  const { batchId } = req.query;
  if (!batchId) return res.status(400).json({ error: 'batchId is required' });

  try {
    const db = new SupabaseClient();
    const { data: batch, error } = await db.client
      .from('preview_batches')
      .select('account_username, posts')
      .eq('preview_id', batchId)
      .single();
    if (error || !batch) return res.status(404).json({ error: 'Batch not found' });

    const accountUsername = batch.account_username;
    const postIndex = Math.max(1, Math.min(99, parseInt(req.query.post, 10) || 1)) - 1;
    const images = (batch.posts?.[postIndex]?.images) || [];
    if (images.length === 0) return res.status(400).json({ error: 'No images to download' });

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder(`${accountUsername}_all_${Date.now()}`);
    let index = 1;
    for (const image of images) {
      try {
        const url = image.imagePath || image.image_path;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const buf = await resp.arrayBuffer();
        const ext = (url && url.split('.').pop()) || 'jpg';
        folder.file(`${index}_${image.aesthetic || 'image'}_${image.id}.${ext}`, Buffer.from(buf));
        index++;
      } catch {}
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${accountUsername}_images_${Date.now()}.zip"`);
    res.status(200).send(zipBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


