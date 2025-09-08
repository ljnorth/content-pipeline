from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
import os

class Settings(BaseSettings):
    supabase_url: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    supabase_anon_key: str = Field(default_factory=lambda: os.getenv("SUPABASE_ANON_KEY", ""))
    supabase_service_role: str = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE", ""))
    supabase_bucket: str = Field(default="fashion-images")
    supabase_prefix_influencer: str = Field(default="influencer")

    redis_url: str = Field(default_factory=lambda: os.getenv("REDIS_URL", ""))
    request_timeout_ms: int = 60000
    max_concurrency: int = 2
    retry_backoff_ms: int = 2000
    influencer_demo_mode: bool = Field(default_factory=lambda: os.getenv("INFLUENCER_DEMO_MODE", "true").lower() == "true")

    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_api_base: str = Field(default_factory=lambda: os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com"))
    higgsfield_api_key: str = Field(default_factory=lambda: os.getenv("HIGGSFIELD_API_KEY", ""))
    higgsfield_base_url: str = Field(default_factory=lambda: os.getenv("HIGGSFIELD_BASE_URL", "https://higgsfieldapi.com/api/v1"))

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
