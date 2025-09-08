from rq import Queue
from redis import from_url
from .deps import get_settings
from typing import Any
from .storage.supabase_db import SupabaseDB
from .storage.supabase import SupabaseStorage

s = get_settings()
redis_conn = from_url(s.redis_url)
q_default = Queue('default', connection=redis_conn)

# Init-or-reuse job

def job_generate_base(payload: dict) -> dict:
    db = SupabaseDB()
    username = (payload.get('persona') or {}).get('username') or payload.get('username')
    job = db.create_job(status='running', stage='init')
    job_id = job['id']
    try:
        if username:
            prof = db.get_account_profile(username)
            if prof and prof.get('influencer_model_id'):
                db.update_job(job_id, status='completed', stage='reused_existing')
                return {"job_id": job_id, "reuse": True, "model_id": prof['influencer_model_id']}
        # DEMO anchor: upload a 1x1 PNG placeholder (replace with real generation later)
        store = SupabaseStorage()
        png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa7\xbb\x0c\x88\x00\x00\x00\x00IEND\xaeB`\x82"
        up = store.upload_bytes(png, f"{db.prefix if hasattr(db,'prefix') else 'influencer'}/raw/{job_id}/anchor.png", content_type='image/png')
        db.insert_asset(job_id, 'base', up.url, meta={"demo": True})
        if username:
            db.set_account_influencer_model(username, str(job_id))
        db.update_job(job_id, status='completed', stage='base_generated')
        return {"job_id": job_id, "anchor_url": up.url, "model_id": str(job_id)}
    except Exception as e:
        db.update_job(job_id, status='failed', stage='init', warnings=[str(e)])
        raise


def enqueue_generate(payload: dict) -> str:
    job = q_default.enqueue(job_generate_base, payload, job_timeout=600)
    return job.get_id()
