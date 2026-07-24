from pathlib import Path
from pydantic import BaseSettings
from typing import Literal


_ENV_FILE = str(Path(__file__).resolve().parent.parent.parent.parent / ".env")


class Settings(BaseSettings):
    asr_provider: Literal["faster_whisper", "deepgram"] = "faster_whisper"
    whisper_model_size: str = "medium"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"
    deepgram_api_key: str = ""

    translation_provider: Literal["ollama", "openrouter"] = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:latest"
    openrouter_api_key: str = ""
    openrouter_model: str = "mistralai/mistral-small"

    tts_provider: Literal["edge_tts", "voicebox"] = "edge_tts"
    voicebox_endpoint: str = "http://localhost:9000"

    vad_min_silence_ms: int = 300
    chunk_target_ms: int = 300
    interrupt_threshold_db: float = -35.0

    vad_max_buffer_ms: int = 3000
    vad_threshold: float = 0.5

    enable_noise_filter: bool = True

    enable_auto_failover: bool = True
    failover_asr_provider: Literal["faster_whisper", "deepgram"] = "deepgram"
    failover_tts_provider: Literal["edge_tts", "voicebox"] = "edge_tts"

    ws_auth_secret: str = "dev-secret-change-in-production"

    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_ws_url: str = "ws://localhost:7880"

    database_url: str = "postgresql+asyncpg://viztr:viztr@localhost:5432/viztr"
    database_echo: bool = False
    database_pool_size: int = 10
    database_max_overflow: int = 20

    redis_url: str = "redis://localhost:6379/0"

    class Config:
        env_file = _ENV_FILE


settings = Settings()