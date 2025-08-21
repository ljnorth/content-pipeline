export function computeIdempotencyKey(jobType, payload = {}) {
  // If user wants no de-dupe at all, treat every call as unique when force is true or when global disable flag is set
  if (payload?.force === true || process.env.DISABLE_IDEMPOTENCY === 'true') return `${jobType}:${Date.now()}`;
  if (payload?.idempotency_key) return payload.idempotency_key;
  if (payload?.date) return `${jobType}:${payload.date}`;
  const today = new Date().toISOString().slice(0, 10);
  return `${jobType}:${today}`;
}


