import logging
import asyncio
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


async def synthesize_speech(text: str, lang: str) -> bytes:
    """Generate TTS audio for the given text."""
    provider = settings.tts_provider
    try:
        if provider == "edge_tts":
            return await _synthesize_edge_tts(text, lang)
        elif provider == "voicebox":
            return await _synthesize_voicebox(text, lang)
        else:
            return await _synthesize_edge_tts(text, lang)
    except Exception as e:
        logger.warning("TTS synthesis failed: %s", e)
        return b""


async def _synthesize_edge_tts(text: str, lang: str) -> bytes:
    """Generate speech using edge-tts (Microsoft Edge TTS)."""
    try:
        import edge_tts
        import io
        
        # Map language codes to edge-tts voices
        voice_map = {
            "en": "en-US-AriaNeural",
            "es": "es-ES-ElviraNeural",
            "fr": "fr-FR-DeniseNeural",
            "de": "de-DE-KatjaNeural",
            "ja": "ja-JP-NanamiNeural",
            "zh": "zh-CN-XiaoxiaoNeural",
            "ar": "ar-SA-ZariyahNeural",
        }
        voice = voice_map.get(lang, "en-US-AriaNeural")
        
        communicate = edge_tts.Communicate(text, voice)
        
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        
        # Convert to WAV format with proper header
        return _pcm16_to_wav(audio_data, 24000)
    except ImportError:
        logger.warning("edge_tts not installed")
        return b""
    except Exception as e:
        logger.warning("edge-tts synthesis failed: %s", e)
        return b""


async def _synthesize_voicebox(text: str, lang: str) -> bytes:
    """Generate speech using Voicebox."""
    try:
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                settings.voicebox_endpoint + "/synthesize",
                json={"text": text, "lang": lang},
            ) as resp:
                if resp.status == 200:
                    return await resp.read()
    except Exception as e:
        logger.warning("Voicebox synthesis failed: %s", e)
    return b""


def _pcm16_to_wav(pcm_data: bytes, sample_rate: int) -> bytes:
    """Add WAV header to raw PCM16 data."""
    import struct
    
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(pcm_data)
    
    wav_header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',           # ChunkID
        36 + data_size,    # ChunkSize
        b'WAVE',           # Format
        b'fmt ',           # Subchunk1ID
        16,                # Subchunk1Size (PCM)
        1,                 # AudioFormat (PCM)
        num_channels,      # NumChannels
        sample_rate,       # SampleRate
        byte_rate,         # ByteRate
        block_align,       # BlockAlign
        bits_per_sample,   # BitsPerSample
        b'data',           # Subchunk2ID
        data_size          # Subchunk2Size
    )
    
    return wav_header + pcm_data