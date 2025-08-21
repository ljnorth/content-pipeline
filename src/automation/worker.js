import { DbQueue } from './queue-db.js';
import { JobHandlers } from './jobs.js';

const WORKER_ID = `wrk_${Math.random().toString(36).slice(2,8)}`;
const POLL_MS = parseInt(process.env.WORKER_POLL_INTERVAL || '5000', 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

const queue = new DbQueue();

async function workOne(job){
  const started = Date.now();
  try{
    const handler = JobHandlers[job.job_type];
    if (!handler) throw new Error(`No handler for ${job.job_type}`);
    const result = await handler(job);
    await queue.complete(job.run_id, true, null, { result, duration_ms: Date.now()-started });
    log('completed', job, result);
  }catch(e){
    await queue.complete(job.run_id, false, e.message, { duration_ms: Date.now()-started });
    log('failed', job, e.message);
  }
}

function log(evt, job, extra){
  console.log(JSON.stringify({ ts:new Date().toISOString(), evt, run_id:job.run_id, job_type:job.job_type, attempt:job.attempt, key:job.idempotency_key, extra }));
}

async function loop(){
  const jobs = await queue.dequeue(WORKER_ID, CONCURRENCY);
  await Promise.all(jobs.map(workOne));
  setTimeout(loop, POLL_MS);
}

console.log(`🚚 Worker ${WORKER_ID} polling ${POLL_MS}ms concurrency=${CONCURRENCY}`);
loop();


