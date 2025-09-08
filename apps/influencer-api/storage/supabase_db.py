from ..deps import get_settings
import requests
from typing import Any, Dict, List

class SupabaseDB:
    def __init__(self):
        s = get_settings()
        self.url = s.supabase_url.rstrip('/')
        self.service_key = s.supabase_service_role or s.supabase_anon_key
        self.rest = f"{self.url}/rest/v1"
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def select(self, table: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
        r = requests.get(f"{self.rest}/{table}", headers=self.headers, params=params, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"Select failed: {r.status_code} {r.text}")
        return r.json()

    def insert(self, table: str, body: Dict[str, Any]) -> Dict[str, Any]:
        r = requests.post(f"{self.rest}/{table}", headers=self.headers, json=body, timeout=60)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Insert failed: {r.status_code} {r.text}")
        data = r.json()
        return data[0] if isinstance(data, list) and data else data

    def update(self, table: str, filters: Dict[str, str], body: Dict[str, Any]) -> List[Dict[str, Any]]:
        r = requests.patch(f"{self.rest}/{table}", headers=self.headers, params=filters, json=body, timeout=60)
        if r.status_code not in (200, 204):
            raise RuntimeError(f"Update failed: {r.status_code} {r.text}")
        return r.json() if r.text else []

    # Convenience helpers
    def get_account_profile(self, username: str) -> Dict[str, Any] | None:
        rows = self.select('account_profiles', { 'username': f'eq.{username}' })
        return rows[0] if rows else None

    def set_account_influencer_model(self, username: str, model_id: str) -> None:
        self.update('account_profiles', { 'username': f'eq.{username}' }, { 'influencer_model_id': model_id })

    def create_job(self, status: str = 'queued', stage: str | None = None) -> Dict[str, Any]:
        return self.insert('influencer_jobs', { 'status': status, 'stage': stage })

    def update_job(self, job_id: str, **fields) -> None:
        self.update('influencer_jobs', { 'id': f'eq.{job_id}' }, fields)

    def insert_asset(self, job_id: str, kind: str, url: str, meta: Dict[str, Any] | None = None, width: int | None = None, height: int | None = None, hashv: str | None = None) -> Dict[str, Any]:
        body = { 'job_id': job_id, 'kind': kind, 'url': url, 'meta': meta or {}, 'width': width, 'height': height, 'hash': hashv }
        return self.insert('influencer_assets', body)
