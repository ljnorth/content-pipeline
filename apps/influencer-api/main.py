from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from .jobs import enqueue_generate

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
    # TODO: pull from DB; demo stub
    return {"status": "queued", "stage": "init", "assets": [], "warnings": []}

@app.post("/v1/influencer/video/{asset_id}")
async def make_video(asset_id: str):
    # TODO: call Higgsfield adapter
    return {"queued": True, "asset_id": asset_id}
