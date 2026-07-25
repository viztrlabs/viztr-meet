import logging
from viztrmeet.core.session import VoxTRSession
from viztrmeet.services.registry import transcribe_with_failover, translate_with_provider, get_tts_provider, synthesize_speech

logger = logging.getLogger(__name__)


async def process_chunk(
    session: VoxTRSession,
    audio_chunk: bytes,
    send_json,
    send_bytes,
):
    session.append_audio(audio_chunk)
    audio_segment = await session.check_vad_and_release()
    if audio_segment is None:
        return

    await send_json({"event": "vad_end", "bytes": len(audio_segment)})

    transcript = await transcribe_with_failover(audio_segment, session.source_lang)
    await send_json({"event": "transcript", "text": transcript, "lang": session.source_lang})

    translated = await translate_with_provider(
        transcript, session.source_lang, session.target_lang
    )
    await send_json({"event": "translation", "text": translated, "lang": session.target_lang})

    # Generate TTS for translated text
    try:
        tts_audio = await synthesize_speech(translated, session.target_lang)
        if tts_audio:
            await send_json({"event": "tts_start", "text": translated})
            await send_bytes(tts_audio)
            await send_json({"event": "tts_end"})
    except Exception as e:
        logger.warning("TTS synthesis failed", exc_info=e)