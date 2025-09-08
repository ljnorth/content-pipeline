from ..deps import get_settings
import requests
from typing import Dict, Any


class HiggsfieldClient:
    def __init__(self) -> None:
        s = get_settings()
        self.base = s.higgsfield_base_url.rstrip('/')
        self.api_key = s.higgsfield_api_key
        # Prefer ID/SECRET if present
        import os
        self.key_id = os.getenv('HIGGSFIELD_API_KEY_ID')
        self.key_secret = os.getenv('HIGGSFIELD_API_KEY_SECRET')

    def _headers(self) -> Dict[str, str]:
        # Two auth modes: ID/SECRET headers or Bearer
        if self.key_id and self.key_secret:
            return {
                'X-API-KEY-ID': self.key_id,
                'X-API-KEY-SECRET': self.key_secret,
                'Content-Type': 'application/json',
            }
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

    def create_image_to_video(self, image_url: str, prompt: str, duration: int = 8, aspect: str = '9:16') -> Dict[str, Any]:
        body = {
            'type': 'image-to-video',
            'image_url': image_url,
            'prompt': prompt,
            'duration': duration,
            'aspect_ratio': aspect,
        }
        r = requests.post(f"{self.base}/generate", json=body, headers=self._headers(), timeout=60)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Higgsfield create failed: {r.status_code} {r.text}")
        return r.json()

    def get_status(self, generation_id: str) -> Dict[str, Any]:
        r = requests.get(f"{self.base}/status/{generation_id}", headers=self._headers(), timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"Higgsfield status failed: {r.status_code} {r.text}")
        return r.json()

