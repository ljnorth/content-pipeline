from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from .jobs import enqueue_generate
from .storage.supabase_db import SupabaseDB

app = FastAPI(title="Influencer API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RunRequest(BaseModel):
    persona: dict
    scenePreset: str | None = None
    posePreset: str | None = None
    moodboard: dict | None = None
    counts: dict | None = None
    video: dict | None = None
    knobs: dict | None = None

@app.get("/v1/health")
async def health():
    return {"ok": True}

@app.post("/v1/influencer/run")
async def run_job(req: RunRequest):
    payload = req.dict()
    job_id = enqueue_generate(payload)
    return {"job_id": job_id}

@app.get("/v1/influencer/status/{job_id}")
async def status(job_id: str):
    db = SupabaseDB()
    job = db.get_job(job_id)
    if not job:
        return {"status": "not_found", "stage": None, "assets": [], "warnings": ["job not found"]}
    assets = db.list_assets(job_id)
    return {"status": job.get('status'), "stage": job.get('stage'), "assets": assets, "warnings": job.get('warnings') or []}

@app.post("/v1/influencer/init/{username}")
async def init_once(username: str):
    # Trigger a run focused on init path for a specific username
    payload = {"username": username, "persona": {"username": username}}
    job_id = enqueue_generate(payload)
    return {"job_id": job_id}

@app.post("/v1/influencer/video/{asset_id}")
async def make_video(asset_id: str):
    # TODO: call Higgsfield adapter
    return {"queued": True, "asset_id": asset_id}
