from .typing import *  # type: ignore
from pydantic import BaseModel
from ..deps import get_settings
import requests
import io

class UploadResult(BaseModel):
    url: str
    path: str

class SupabaseStorage:
    def __init__(self):
        s = get_settings()
        self.url = s.supabase_url.rstrip('/')
        self.anon_key = s.supabase_anon_key
        self.service_key = s.supabase_service_role or s.supabase_anon_key
        self.bucket = s.supabase_bucket
        self.prefix = s.supabase_prefix_influencer
        self.rest = f"{self.url}/storage/v1"
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}"
        }

    def upload_bytes(self, data: bytes, subpath: str, content_type: str = 'image/png') -> UploadResult:
        path = f"{self.prefix}/{subpath}"
        r = requests.post(
            f"{self.rest}/object/{self.bucket}/{path}",
            headers={**self.headers, "Content-Type": content_type},
            data=data,
            timeout=60
        )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Upload failed: {r.status_code} {r.text}")
        # public URL
        pub = f"{self.rest}/object/public/{self.bucket}/{path}"
        return UploadResult(url=pub, path=path)
