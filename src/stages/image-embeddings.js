import fetch from "node-fetch";
import pLimit from "p-limit";
import { embedBuffer } from "../utils/sagemaker.js";
import { SupabaseClient } from "../database/supabase-client.js";

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

class TokenBucket {
  constructor(maxPerSecond){
    this.maxPerSecond = Math.max(1, Number(maxPerSecond || 5));
    this.tokens = this.maxPerSecond;
    setInterval(() => { this.tokens = this.maxPerSecond; }, 1000);
  }
  async take(){
    while (this.tokens <= 0){ await sleep(10); }
    this.tokens -= 1;
  }
}

export class ImageEmbeddings {
  constructor(){
    this.db = new SupabaseClient();
    this.maxConcurrency = Number(process.env.EMBED_MAX_CONCURRENCY || 8);
    this.maxRps = Number(process.env.EMBED_MAX_RPS || 5);
    this.limit = pLimit(this.maxConcurrency);
    this.bucket = new TokenBucket(this.maxRps);
  }

  async fetchBytes(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  async embedMissing(limitBatch = 200){
    const { data: rows } = await this.db.client
      .from("images")
      .select("id,image_path,embedding")
      .is("embedding", null)
      .limit(limitBatch);
    if (!rows || rows.length === 0) return { processed: 0 };

    let ok = 0; let failed = 0;
    await Promise.all(rows.map(row => this.limit(async () => {
      await this.bucket.take();
      try{
        const buf = await this.fetchBytes(row.image_path);
        const vec = await embedBuffer(buf);
        await this.db.client.from("images").update({ embedding: vec }).eq("id", row.id);
        ok++;
      }catch(_){ failed++; }
    })));
    return { processed: rows.length, updated: ok, failed };
  }
}


