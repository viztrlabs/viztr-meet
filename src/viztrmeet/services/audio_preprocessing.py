import asyncio
import logging
from viztrmeet.core.config import settings

logger = logging.getLogger(__name__)

_HAS_NR = True
try:
    import numpy as np
    import noisereduce as nr
except ImportError:
    _HAS_NR = False
    logger.warning("noisereduce/numpy not available, noise filtering disabled")


def denoise_pcm16(audio_bytes: bytes) -> bytes:
    if not settings.enable_noise_filter or not _HAS_NR:
        return audio_bytes

    audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    denoised = nr.reduce_noise(y=audio_np, sr=16000, prop_decrease=0.8)
    return (denoised * 32768).astype(np.int16).tobytes()


async def async_denoise_pcm16(audio_bytes: bytes) -> bytes:
    return await asyncio.to_thread(denoise_pcm16, audio_bytes)
