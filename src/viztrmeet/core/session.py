import time
import asyncio
from dataclasses import dataclass, field
from typing import Optional

from viztrmeet.core.config import settings

_vad_model = None
_get_speech_timestamps = None
BYTES_PER_MS = 32


def _lazy_load_vad():
    global _vad_model, _get_speech_timestamps
    if _vad_model is not None:
        return
    import numpy as np
    import torch
    _vad_model, _vad_utils = torch.hub.load(
        repo_or_dir='snakers4/silero-vad',
        model='silero_vad',
        force_reload=False,
        onnx=False,
    )
    (_get_speech_timestamps, _, _, _, _) = _vad_utils


@dataclass
class VoxTRSession:
    room_id: str
    participant_id: str
    source_lang: str
    target_lang: str

    audio_buffer: bytearray = field(default_factory=bytearray)
    last_chunk_time: float = field(default_factory=time.time)

    is_speaking_output: bool = False
    current_tts_task: Optional[asyncio.Task] = None

    asr_provider_override: Optional[str] = None
    translation_provider_override: Optional[str] = None
    tts_provider_override: Optional[str] = None

    _last_vad_check_bytes: int = field(default=0)

    def append_audio(self, chunk: bytes) -> None:
        self.audio_buffer.extend(chunk)
        self.last_chunk_time = time.time()

    async def check_vad_and_release(self) -> Optional[bytes]:
        buffer_len = len(self.audio_buffer)
        if buffer_len == 0:
            return None

        max_buffer_bytes = settings.vad_max_buffer_ms * BYTES_PER_MS
        if buffer_len >= max_buffer_bytes:
            ready = bytes(self.audio_buffer)
            self.audio_buffer.clear()
            self._last_vad_check_bytes = 0
            return ready

        min_buffer_bytes = settings.chunk_target_ms * BYTES_PER_MS
        if buffer_len < min_buffer_bytes:
            return None

        if self._last_vad_check_bytes > 0 and \
           buffer_len - self._last_vad_check_bytes < min_buffer_bytes:
            return None

        try:
            import numpy as np
        except ImportError:
            ready = bytes(self.audio_buffer)
            self.audio_buffer.clear()
            self._last_vad_check_bytes = 0
            return ready

        _lazy_load_vad()

        audio_np = np.frombuffer(
            bytes(self.audio_buffer), dtype=np.int16
        ).astype(np.float32) / 32768.0

        speech_timestamps = await asyncio.to_thread(
            _get_speech_timestamps,
            audio_np,
            _vad_model,
            sampling_rate=16000,
            threshold=settings.vad_threshold,
            min_silence_duration_ms=settings.vad_min_silence_ms,
            min_speech_duration_ms=100,
            speech_pad_ms=0,
        )

        self._last_vad_check_bytes = buffer_len

        if not speech_timestamps:
            return None

        last_ts = speech_timestamps[-1]
        end_sample = last_ts["end"]

        if end_sample < len(audio_np) - 1:
            release_bytes = (end_sample + 1) * 2
            ready = bytes(self.audio_buffer[:release_bytes])
            remaining = bytes(self.audio_buffer[release_bytes:])
            self.audio_buffer.clear()
            self.audio_buffer.extend(remaining)
            self._last_vad_check_bytes = 0
            return ready

        return None

    def cancel_tts_if_playing(self):
        if self.current_tts_task and not self.current_tts_task.done():
            self.current_tts_task.cancel()
        self.is_speaking_output = False


active_sessions: dict[str, VoxTRSession] = {}
