import { SupabaseClient } from '../database/supabase-client.js';

export class Checkpoints {
  constructor(){ this.db = new SupabaseClient(); }
  async set(runId, cursor){
    await this.db.client.rpc('upsert_checkpoint', { p_run_id: runId, p_cursor: cursor });
  }
  async get(runId){
    const { data } = await this.db.client.from('job_checkpoints').select('*').eq('run_id', runId).single();
    return data?.cursor || null;
  }
}


