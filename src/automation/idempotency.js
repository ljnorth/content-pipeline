export function computeIdempotencyKey(jobType, payload = {}) {
  // Allow explicit bypass via force flag
  if (payload?.force === true) return `${jobType}:${Date.now()}`;
  if (payload?.idempotency_key) return payload.idempotency_key;
  if (payload?.date) return `${jobType}:${payload.date}`;
  const today = new Date().toISOString().slice(0, 10);
  return `${jobType}:${today}`;
}


