import sharp from 'sharp';
import { SupabaseClient } from '../database/supabase-client.js';

export class ImageSanitiser {
  constructor(){
    this.db = new SupabaseClient();
  }

  async washImageRecord(image){
    // image: { id, image_path, username, post_id }
    const url = image.image_path;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());

    // Strip metadata, tiny perturbation to break hashes
    const washed = await sharp(buf)
      .rotate() // normalize orientation
      .modulate({ brightness: 1.005 })
      .jpeg({ mozjpeg: true })
      .toBuffer();

    // Store new file in a pseudo path replacing original filename with id-based name
    const filename = `washed_${image.id}.jpg`;
    const storagePath = `washed/${image.username || 'unknown'}/${image.post_id || 'free'}/${filename}`;

    // Upload via RPC using signed URL (reuse public storage REST)
    const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent('fashion-images')}/${storagePath}`;
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: washed
    });
    if (!up.ok) throw new Error(`upload ${up.status}`);

    // Make public URL
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/fashion-images/${storagePath}`;

    // Update DB row
    await this.db.client.from('images').update({
      original_image_path: image.image_path,
      image_path: publicUrl,
      washed: true
    }).eq('id', image.id);

    return publicUrl;
  }
}


