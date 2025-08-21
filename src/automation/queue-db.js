import { SupabaseClient } from '../database/supabase-client.js';
import { computeIdempotencyKey } from './idempotency.js';

export class DbQueue {
  constructor(){ this.db = new SupabaseClient(); }

  async enqueue(jobType, payload = {}, opts = {}){
    const idempotency_key = computeIdempotencyKey(jobType, payload);
    const row = { job_type: jobType, idempotency_key, payload, status:'queued', max_attempts: opts.maxAttempts ?? 5 };
    const { data, error } = await this.db.client.from('job_runs').insert(row).select().single();
    if (error){
      if ((error.code||'').toString() === '23505'){
        const { data: existing } = await this.db.client.from('job_runs').select('*').eq('idempotency_key', idempotency_key).single();
        return existing;
      }
      throw error;
    }
    return data;
  }

  async dequeue(workerId, limit = 1){
    const { data, error } = await this.db.client.rpc('dequeue_jobs', { worker_id: workerId, fetch_limit: limit });
    if (error) throw error;
    return data || [];
  }

  async complete(runId, success, errorExcerpt = null, metrics = null){
    const { error } = await this.db.client.rpc('complete_job', { p_run_id: runId, p_success: success, p_error: errorExcerpt, p_metrics: metrics });
    if (error) throw error;
  }
}


