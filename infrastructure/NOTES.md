# Deployment Notes (Render)

- Deploy services via `infrastructure/render.yaml` as a Blueprint.
- Set env vars (secrets) in Render dashboard: SUPABASE_* keys, GEMINI_API_KEY, HIGGSFIELD_API_KEY.
- Render has no GPUs; run with `MODEL_ACCEL=cpu` and `INFLUENCER_DEMO_MODE=true`.
- For production GPU, deploy this same FastAPI + worker to a GPU host (Modal/RunPod/AWS) and set `INFLUENCER_API_BASE` in your Node app to that URL. No UI/API changes needed.
