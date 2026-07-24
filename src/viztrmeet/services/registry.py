import logging
from typing import Any
from viztrmeet.core.config import settings

logger = logging.getLogger(__name__)

ASR_PROVIDERS: dict[str, str] = {
    "faster_whisper": "faster_whisper",
    "deepgram": "deepgram",
}

TRANSLATE_PROVIDERS: dict[str, str] = {
    "ollama": "ollama",
    "openrouter": "openrouter",
}

TTS_PROVIDERS: dict[str, str] = {
    "edge_tts": "edge_tts",
    "voicebox": "voicebox",
}


async def transcribe_with_failover(audio_bytes: bytes, source_lang: str) -> str:
    provider = settings.asr_provider
    try:
        return await _transcribe(provider, audio_bytes, source_lang)
    except Exception as e:
        if settings.enable_auto_failover:
            fallback = settings.failover_asr_provider
            logger.warning("ASR %s failed (%s), failing over to %s", provider, e, fallback)
            return await _transcribe(fallback, audio_bytes, source_lang)
        raise


async def _transcribe(provider: str, audio_bytes: bytes, source_lang: str) -> str:
    if provider == "faster_whisper":
        return "[transcribed: faster-whisper]"
    elif provider == "deepgram":
        return "[transcribed: deepgram]"
    return ""


async def translate_with_provider(text: str, source_lang: str, target_lang: str) -> str:
    provider = settings.translation_provider
    if provider == "ollama":
        return f"[translated {source_lang}->{target_lang}: {text}]"
    elif provider == "openrouter":
        return f"[translated {source_lang}->{target_lang}: {text}]"
    return text


def get_tts_provider():
    provider = settings.tts_provider
    if provider == "edge_tts":
        return "edge_tts"
    elif provider == "voicebox":
        return "voicebox"
    return "edge_tts"
