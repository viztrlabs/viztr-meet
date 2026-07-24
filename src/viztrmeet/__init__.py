__version__ = "0.1.0"
__author__ = "VizTR Team"
__description__ = "Real-time voice translation for meetings"

from viztrmeet.core.config import settings
from viztrmeet.core.session import VoxTRSession, active_sessions
from viztrmeet.core.pipeline import process_chunk
from viztrmeet.services.registry import (
    ASR_PROVIDERS,
    TRANSLATE_PROVIDERS,
    TTS_PROVIDERS,
    transcribe_with_failover,
    translate_with_provider,
    get_tts_provider,
)

__all__ = [
    "VoxTRSession",
    "settings",
    "active_sessions",
    "process_chunk",
    "ASR_PROVIDERS",
    "TRANSLATE_PROVIDERS",
    "TTS_PROVIDERS",
    "transcribe_with_failover",
    "translate_with_provider",
    "get_tts_provider",
]
