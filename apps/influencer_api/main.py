import os, io, base64, tempfile, time, uuid, threading
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Body, status
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from PIL import Image
import requests
from openai import OpenAI
from openai import OpenAI

app = FastAPI(default_response_class=ORJSONResponse)


class Persona(BaseModel):
    gender: Optional[str] = None
    age: Optional[str] = None
    eyeColor: Optional[str] = None
    ethnicity: Optional[str] = None
    skinTone: Optional[str] = None
    skinFeatures: Optional[List[str]] = None
    hair: Optional[str] = None
    hairColor: Optional[str] = None
    stylePreset: Optional[str] = None


def persona_to_prompt(p: Optional[Persona]) -> str:
    if not p:
        return "high quality fashion influencer portrait, editorial lighting, streetwear"
    parts = [
        p.gender or "",
        p.age or "",
        p.ethnicity or "",
        p.skinTone or "",
        f"{p.eyeColor} eyes" if p.eyeColor else "",
        p.hairColor or "",
        p.hair or "",
        p.stylePreset or "streetwear",
    ]
    return ", ".join([x for x in parts if x]).strip() + ", high quality portrait, editorial, crisp details"


def _get_env(k: str, required: bool = True) -> Optional[str]:
    v = os.getenv(k)
    if required and not v:
        raise RuntimeError(f"Missing env: {k}")
    return v

def _fetch_img_to_pil(url: str) -> Image.Image:
    r = requests.get(url, stream=True, timeout=120)
    r.raise_for_status()
    return Image.open(r.raw).convert("RGB")

def flux_txt2img(prompt: str, width: int = 768, height: int = 1024, *, negative: Optional[str] = None, seed: Optional[str] = None) -> Image.Image:
    base = _get_env("FLUX_API_BASE")
    key = _get_env("FLUX_PRO_API_KEY")
    url = f"{base.rstrip('/')}/text-to-image"
    payload: Dict[str, Any] = {"prompt": prompt, "width": width, "height": height}
    if negative: payload["negative_prompt"] = negative
    if seed: payload["seed"] = str(seed)
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload,
        timeout=180,
    )
    r.raise_for_status()
    j = r.json()
    # Accept either direct data URL, base64, or hosted URL
    if isinstance(j, dict):
        if j.get("image"):
            img_field = j["image"]
            if isinstance(img_field, str) and img_field.startswith("http"):
                return _fetch_img_to_pil(img_field)
            if isinstance(img_field, str) and img_field.startswith("data:image"):
                head, b64 = img_field.split(",", 1)
                return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        if j.get("images"):
            img_url = j["images"][0]
            return _fetch_img_to_pil(img_url)
    raise RuntimeError("Unexpected FLUX response shape")

def upscaler_upscale(img: Image.Image, scale: int = 2) -> Image.Image:
    base = _get_env("UPSCALER_API_BASE")
    key = _get_env("UPSCALER_API_KEY")
    buf = io.BytesIO(); img.save(buf, format="PNG")
    payload = {"scale": scale, "image": f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"}
    r = requests.post(
        f"{base.rstrip('/')}/upscale",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload,
        timeout=300,
    )
    r.raise_for_status()
    j = r.json()
    out = j.get("image") or (j.get("images") or [None])[0]
    if not out:
        raise RuntimeError("Upscaler returned no image")
    if out.startswith("http"):
        return _fetch_img_to_pil(out)
    if out.startswith("data:image"):
        head, b64 = out.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    raise RuntimeError("Unexpected upscaler response shape")


def flux_i2i(init_img: Image.Image, prompt: str, strength: float = 0.35, width: int = 768, height: int = 1024, *, negative: Optional[str] = None, seed: Optional[str] = None) -> Image.Image:
    base = _get_env("FLUX_API_BASE")
    key = _get_env("FLUX_PRO_API_KEY")
    url = f"{base.rstrip('/')}/image-to-image"
    buf = io.BytesIO(); init_img.save(buf, format="PNG")
    payload: Dict[str, Any] = {
        "image": f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}",
        "prompt": prompt,
        "strength": strength,
        "width": width,
        "height": height,
    }
    if negative: payload["negative_prompt"] = negative
    if seed: payload["seed"] = str(seed)
    r = requests.post(url, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload, timeout=300)
    r.raise_for_status()
    j = r.json()
    out = j.get("image") or (j.get("images") or [None])[0]
    if not out:
        raise RuntimeError("FLUX i2i returned no image")
    if out.startswith("http"):
        return _fetch_img_to_pil(out)
    if out.startswith("data:image"):
        head, b64 = out.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    raise RuntimeError("Unexpected FLUX i2i response shape")

def pil_to_data_url(img: Image.Image, fmt="PNG") -> str:
    buf = io.BytesIO(); img.save(buf, format=fmt)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/{fmt.lower()};base64,{b64}"


# Removed MoviePy fallback; videos must come from provider

def video_to_data_url(path: str) -> str:
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:video/mp4;base64,{b64}"

def _load_image_from_any(src: str) -> Image.Image:
    if src.startswith("http"):
        return _fetch_img_to_pil(src)
    if src.startswith("data:image"):
        head, b64 = src.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    # assume raw base64
    try:
        return Image.open(io.BytesIO(base64.b64decode(src))).convert("RGB")
    except Exception:
        raise RuntimeError("Unsupported image input format")


_slack = WebClient(token=os.getenv("SLACK_BOT_TOKEN")) if os.getenv("SLACK_BOT_TOKEN") else None
_slack_channel = os.getenv("SLACK_CHANNEL", "#content-bot")
_higgs_base = os.getenv("HIGGSFIELD_API_BASE")  # legacy/custom API (kept for fallback)
_higgs_key = os.getenv("HIGGSFIELD_API_KEY")
_higgs_secret = os.getenv("HIGGSFIELD_API_SECRET")
_higgs_platform_base = os.getenv("HIGGSFIELD_PLATFORM_API_BASE", "https://platform.higgsfield.ai/v1")
_higgs_model = os.getenv("HIGGSFIELD_MODEL", "seedance pro")
_higgs_motion_id = os.getenv("HIGGSFIELD_MOTION_ID", "cb27169d-aba4-43d9-8667-3292966b2de5")
_higgs_enhance_prompt = (os.getenv("HIGGSFIELD_ENHANCE_PROMPT", "true").lower() == "true")
_higgs_seed = os.getenv("HIGGSFIELD_SEED")
_openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
_gemini_base = os.getenv("GEMINI_API_BASE")
_gemini_key = os.getenv("GEMINI_API_KEY")
_gemini_model = os.getenv("GEMINI_MODEL", "nanobanana")
_openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None

# Supabase storage config
_sb_url = os.getenv("SUPABASE_URL")
_sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
_sb_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "influencer")

# ---- Prompt templates ----
IDENTITY_LOCK_NEGATIVE = (
    "different person, face swap, identity drift, age change, beard, mustache, different ethnicity, "
    "different hair color, wig, hat, heavy makeup change, eye color change, skin tone shift, plastic skin, "
    "over-sharpening, artifacts, extra fingers, deformed hands, duplicate face, motion blur, low-res"
)
DEFAULT_SEED = os.getenv("FLUX_SEED")

# Provider selection: "replicate" (default) or "gpu"
_provider = (os.getenv("INFERENCE_PROVIDER") or "replicate").lower()
_gpu_base = os.getenv("GPU_API_BASE")


@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"ok": True}


@app.post("/preview-still")
def preview_still(persona: Optional[Persona] = Body(None)):
    if _provider == "gpu" and _gpu_base:
        r = requests.post(f"{_gpu_base}/preview-still", json={"persona": persona.model_dump() if persona else None}, timeout=300)
        return r.json()
    # FLUX + optional upscaler
    img = flux_txt2img(persona_to_prompt(persona))
    if os.getenv("UPSCALER_API_BASE") and os.getenv("UPSCALER_API_KEY"):
        try:
            img = upscaler_upscale(img)
        except Exception:
            pass
    return {"success": True, "imageUrl": pil_to_data_url(img)}


@app.post("/run-full-to-slack")
def run_full_to_slack(
    username: str = Body(..., embed=True),
    persona: Optional[Persona] = Body(None),
    moodboards: Optional[List[str]] = Body(None),
    outputs: Optional[Dict[str, Any]] = Body(None),
):
    # If GPU provider is configured, forward to GPU API (it will generate and upload)
    if _provider == "gpu" and _gpu_base:
        r = requests.post(
            f"{_gpu_base}/run-full-to-slack",
            json={"username": username, "persona": persona.model_dump() if persona else None},
            timeout=600,
        )
        return r.json()

    # Provider API path (FLUX)
    persona_img = flux_txt2img(persona_to_prompt(persona), negative=IDENTITY_LOCK_NEGATIVE, seed=DEFAULT_SEED)
    # Moodboards: require provided from pipeline
    if moodboards and len(moodboards) > 0:
        mood = [_load_image_from_any(u) for u in moodboards]
    else:
        raise RuntimeError("No moodboards provided; UI/server must supply from embeddings pipeline")
    # Stills: one per moodboard via Gemini (required)
    if not (_gemini_base and _gemini_key):
        raise RuntimeError("Gemini not configured: set GEMINI_API_BASE and GEMINI_API_KEY")
    stills: List[Image.Image] = []
    for mb in (moodboards or []):
        payload = {"model": _gemini_model, "character": pil_to_data_url(persona_img), "moodboard": mb, "prompt": "show this subject wearing the clothes while making outfit/get ready with me content in their bedroom"}
        rr = requests.post(f"{_gemini_base.rstrip('/')}/image-compose", headers={"Authorization": f"Bearer {_gemini_key}", "Content-Type": "application/json"}, json=payload, timeout=300)
        rr.raise_for_status(); jj = rr.json(); out = jj.get("image") or (jj.get("images") or [None])[0]
        if not out:
            raise RuntimeError("Gemini returned no image for moodboard")
        stills.append(_load_image_from_any(out))
    if os.getenv("UPSCALER_API_BASE") and os.getenv("UPSCALER_API_KEY"):
        try:
            persona_img = upscaler_upscale(persona_img)
            mood = [upscaler_upscale(im) for im in mood]
            stills = [upscaler_upscale(im) for im in stills]
        except Exception:
            pass
    # Create a real video per still via Higgsfield using the prompt (if requested)
    videos: List[str] = []
    if (outputs or {}).get("videos", True):
        for st in stills:
            gen_id = higgsfield_start_video([st], prompt="show this subject wearing the clothes while making outfit/get ready with me content in their bedroom")
            vp = higgsfield_wait_video(gen_id, timeout_s=600)
            videos.append(vp)

    uploaded = []
    errors = []
    if _slack:
        try:
            _slack.chat_postMessage(channel=_slack_channel, text=f"🎯 Influencer bundle for @{username} — {len(mood)} moodboards, {len(stills)} stills, {len(videos)} videos")
            def save(img, name):
                p = os.path.join(tempfile.mkdtemp(prefix="bundle_"), name); img.save(p); return p
            files = [save(persona_img, "persona.png")]
            if (outputs or {}).get("moodboards", True):
                files += [save(im, f"mood_{i+1}.png") for i, im in enumerate(mood)]
            if (outputs or {}).get("stills", True):
                files += [save(im, f"still_{i+1}.png") for i, im in enumerate(stills)]
            if (outputs or {}).get("videos", True):
                for i, vp in enumerate(videos):
                    files.append(vp)
            for fp in files:
                _slack.files_upload_v2(channel=_slack_channel, file=fp, title=os.path.basename(fp))
                uploaded.append(os.path.basename(fp))
        except SlackApiError as e:
            errors.append(str(e))
    else:
        errors.append("SLACK_BOT_TOKEN not set; skipping upload")

    # Persist assets to Supabase if configured
    persisted: Dict[str, Any] = {"persona": None, "moodboards": [], "stills": [], "videos": []}
    try:
        if _sb_url and _sb_key:
            base_prefix = f"{username}/{int(time.time())}/"
            persisted["persona"] = _upload_image(persona_img, base_prefix + "persona.png")
            if (outputs or {}).get("moodboards", True):
                for i, im in enumerate(mood):
                    persisted["moodboards"].append(_upload_image(im, base_prefix + f"mood_{i+1}.png"))
            if (outputs or {}).get("stills", True):
                for i, im in enumerate(stills):
                    persisted["stills"].append(_upload_image(im, base_prefix + f"still_{i+1}.png"))
            if (outputs or {}).get("videos", True):
                for i, vp in enumerate(videos):
                    persisted["videos"].append(_upload_file(vp, base_prefix + f"video_{i+1}.mp4", "video/mp4"))
    except Exception as e:
        errors.append(f"storage: {str(e)}")

    return {"success": True, "uploaded": uploaded, "persisted": persisted, "errors": errors, "counts": {"moodboards": len(mood), "stills": len(stills), "videos": len(videos)}, "outputs": outputs or {"moodboards": True, "stills": True, "videos": True}}

# --------- Higgsfield helpers ---------
def _image_to_url_or_data(img: Image.Image) -> str:
    # Prefer data URL for now; platform may accept only URLs—handled by caller if needed
    return pil_to_data_url(img, fmt="PNG")

def higgsfield_start_video(stills: List[Image.Image], prompt: str) -> str:
    """Start video via Higgsfield platform API if configured; otherwise legacy fallback."""
    # Platform API required
    if _higgs_key and _higgs_secret and _higgs_platform_base:
        # Use the first still as input image
        img_url = _image_to_url_or_data(stills[0])
        params: Dict[str, Any] = {
            "model": _higgs_model,
            "prompt": prompt,
            "motions": [{"id": _higgs_motion_id, "strength": 0.5}],
            "input_images": [{"type": "image_url", "image_url": img_url}],
            "enhance_prompt": True if _higgs_enhance_prompt else False,
            "check_nsfw": True,
        }
        if _higgs_seed:
            try:
                params["seed"] = int(_higgs_seed)
            except Exception:
                pass
        body: Dict[str, Any] = {"params": params}
        # Optional webhook support via env
        if os.getenv("HIGGSFIELD_WEBHOOK_URL"):
            body["webhook"] = {
                "url": os.getenv("HIGGSFIELD_WEBHOOK_URL"),
                "secret": os.getenv("HIGGSFIELD_WEBHOOK_SECRET", "")
            }
        r = requests.post(
            f"{_higgs_platform_base.rstrip('/')}/image2video",
            headers={
                "Content-Type": "application/json",
                "hf-api-key": _higgs_key,
                "hf-secret": _higgs_secret,
            },
            json=body,
            timeout=300,
        )
        r.raise_for_status()
        j = r.json()
        gen_id = j.get("job_id") or j.get("id") or j.get("generation_id") or j.get("task_id")
        if not gen_id:
            raise RuntimeError(f"Higgsfield platform start: unknown response {j}")
        return gen_id
    raise RuntimeError("HIGGSFIELD platform API credentials not set (HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET)")

def higgsfield_wait_video(generation_id: str, timeout_s: int = 600) -> str:
    """Poll platform API for completion; return local MP4 path."""
    start = time.time()
    while time.time() - start < timeout_s:
        if not (_higgs_key and _higgs_secret and _higgs_platform_base):
            raise RuntimeError("HIGGSFIELD platform API credentials not set (HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET)")
        # Platform job status
        r = requests.get(
            f"{_higgs_platform_base.rstrip('/')}/jobs/{generation_id}",
            headers={
                "hf-api-key": _higgs_key,
                "hf-secret": _higgs_secret,
            },
            timeout=60,
        )
        r.raise_for_status()
        j = r.json()
        status_val = j.get("status") or j.get("state")
        # Try multiple common shapes for URL
        vid_url = (
            j.get("videoUrl") or j.get("video_url") or
            (j.get("result") or {}).get("video", {}).get("url") or
            ((j.get("outputs") or [{}])[0] or {}).get("url")
        )
        if (status_val == "completed" or status_val == "succeeded") and vid_url:
            tmp = tempfile.mkdtemp(prefix="higgs_")
            out = os.path.join(tmp, "out.mp4")
            with requests.get(vid_url, stream=True, timeout=180) as rs:
                rs.raise_for_status()
                with open(out, "wb") as f:
                    for chunk in rs.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
            return out
        if status_val in ("failed", "canceled", "error"):
            raise RuntimeError(f"Higgsfield platform video failed: {j}")
        time.sleep(2)
    raise RuntimeError("Higgsfield video timeout")

# --------- Character builder (prompt + variants) ----------
CHAR_JOBS: Dict[str, Dict[str, Any]] = {}

def _sb_upload_bytes(path_key: str, data: bytes, content_type: str) -> str:
    if not _sb_url or not _sb_key:
        raise RuntimeError("Supabase storage not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    url = f"{_sb_url.rstrip('/')}/storage/v1/object/{_sb_bucket}/{path_key}"
    r = requests.put(url, headers={"Authorization": f"Bearer {_sb_key}", "Content-Type": content_type}, data=data, timeout=120)
    r.raise_for_status()
    # Assume bucket is public
    return f"{_sb_url.rstrip('/')}/storage/v1/object/public/{_sb_bucket}/{path_key}"

def _upload_image(img: Image.Image, path_key: str) -> str:
    buf = io.BytesIO(); img.save(buf, format="PNG"); return _sb_upload_bytes(path_key, buf.getvalue(), "image/png")

def _upload_file(path: str, path_key: str, content_type: str) -> str:
    with open(path, "rb") as f:
        return _sb_upload_bytes(path_key, f.read(), content_type)

@app.post("/character/prompt")
def character_prompt(persona: Optional[Persona] = Body(None)):
    if not _openai:
        return {"success": False, "error": "OPENAI_API_KEY not set"}
    sys = (
        "You write identity-locked prompts for diffusion models. "
        "Output only the prompt. Encode immutable traits and forbid changes to face/hair/skin."
    )
    desc = persona_to_prompt(persona)
    user = (
        f"Create a single prompt describing this subject: {desc}. "
        "Add: 'same person', 'maintain identity', 'do not change face/hair/skin tone', "
        "'consistent eye color', 'consistent hairstyle', 'consistent race/ethnicity', 'same height/weight'. "
        "Use precise photographic language; 85mm portrait quality."
    )
    res = _openai.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[{"role":"system","content":sys},{"role":"user","content":user}],
        temperature=0.25,
        max_tokens=300,
    )
    prompt = (res.choices[0].message.content or "").strip()
    return {"success": True, "prompt": prompt}


@app.post("/character/build")
def character_build(
    username: str = Body(..., embed=True),
    persona: Optional[Persona] = Body(None),
    count: int = Body(25, embed=True),
):
    job_id = f"char_{uuid.uuid4().hex[:10]}"
    CHAR_JOBS[job_id] = {"status": "queued", "username": username, "startedAt": time.time()}

    def _bg():
        try:
            CHAR_JOBS[job_id]["status"] = "running"
            # 1) Prompt
            pr = character_prompt(persona)
            id_prompt = pr.get("prompt", persona_to_prompt(persona))
            CHAR_JOBS[job_id]["prompt"] = id_prompt
            # 2) Base
            base = flux_txt2img(id_prompt)
            if os.getenv("UPSCALER_API_BASE") and os.getenv("UPSCALER_API_KEY"):
                try:
                    base = upscaler_upscale(base)
                except Exception:
                    pass
            base_url = pil_to_data_url(base)
            # 3) Variants
            angles = ["front", "3/4 left", "3/4 right", "profile left", "profile right"]
            zooms = ["head-and-shoulders", "torso", "full body"]
            bgs = ["bedroom", "closet", "mirror", "window light", "neutral wall"]
            outfits = ["denim jacket + tee", "knit sweater + pleated skirt", "cargo pants + crop top", "blazer + jeans", "summer dress"]
            identity = "same person, maintain identity, do not change face/hair/skin tone/eye color, same ethnicity, same hair"
            variants: List[str] = []
            i = 0
            while len(variants) < max(1, int(count)):
                angle = angles[i % len(angles)]
                zoom = zooms[i % len(zooms)]
                bg = bgs[i % len(bgs)]
                outfit = outfits[i % len(outfits)]
                v_prompt = f"{id_prompt}; {identity}; pose: {angle}; framing: {zoom}; background: {bg}; outfit: {outfit}"
                img = flux_i2i(base, v_prompt, strength=0.35, negative=IDENTITY_LOCK_NEGATIVE, seed=DEFAULT_SEED)
                if os.getenv("UPSCALER_API_BASE") and os.getenv("UPSCALER_API_KEY"):
                    try:
                        img = upscaler_upscale(img)
                    except Exception:
                        pass
                variants.append(pil_to_data_url(img))
                i += 1
            CHAR_JOBS[job_id].update({"status": "completed", "base": base_url, "variants": variants, "count": len(variants)})
        except Exception as e:
            CHAR_JOBS[job_id].update({"status": "failed", "error": str(e)})

    threading.Thread(target=_bg, daemon=True).start()
    return {"success": True, "job_id": job_id}


@app.get("/character/build-status")
def character_build_status(job_id: str):
    j = CHAR_JOBS.get(job_id)
    if not j:
        return {"success": False, "error": "job not found"}
    return {"success": True, **j}


# --------- Still and Video endpoints using character + moodboard ----------
@app.post("/still")
def generate_still(
    username: str = Body(..., embed=True),
    character_base: str = Body(..., embed=True),  # data URL or http
    moodboard_url: str = Body(..., embed=True),
    prompt: str = Body("show this subject wearing the clothes while making outfit/get ready with me content in their bedroom", embed=True),
):
    # Use Gemini (nanobanana) to compose a guided still from the character + moodboard
    if not _gemini_base or not _gemini_key:
        return {"success": False, "error": "Gemini not configured"}
    payload = {
        "model": _gemini_model,
        "character": character_base,
        "moodboard": moodboard_url,
        "prompt": prompt,
    }
    r = requests.post(
        f"{_gemini_base.rstrip('/')}/image-compose",
        headers={"Authorization": f"Bearer {_gemini_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=300,
    )
    r.raise_for_status()
    j = r.json()
    out = j.get("image") or (j.get("images") or [None])[0]
    if not out:
        return {"success": False, "error": "Gemini returned no image"}
    img = _load_image_from_any(out)
    if os.getenv("UPSCALER_API_BASE") and os.getenv("UPSCALER_API_KEY"):
        try:
            img = upscaler_upscale(img)
        except Exception:
            pass
    return {"success": True, "imageUrl": pil_to_data_url(img)}


@app.post("/video-from-stills")
def video_from_stills(
    username: str = Body(..., embed=True),
    stills: List[str] = Body(...),  # list of data URLs or http
    prompt: str = Body("show this subject wearing the clothes while making outfit/get ready with me content in their bedroom", embed=True),
):
    # Convert incoming stills to PIL, then pass to Higgsfield; return MP4 data url
    images = [_load_image_from_any(s) for s in stills]
    gen_id = higgsfield_start_video(images, prompt=prompt)
    vid_path = higgsfield_wait_video(gen_id, timeout_s=600)
    return {"success": True, "videoUrl": video_to_data_url(vid_path)}

