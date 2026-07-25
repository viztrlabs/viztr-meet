"""
WebSocket audio endpoint with JWT authentication.

FIX vs pasted draft: the connection now carries room_id + participant_id +
language pair as query params, authenticates via JWT token before accepting,
and includes noise filtering before processing.
"""
import uuid
import jwt
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from viztrmeet.core.config import settings
from viztrmeet.core.session import VoxTRSession, active_sessions
from viztrmeet.core.pipeline import process_chunk

router = APIRouter()
logger = logging.getLogger(__name__)

# Lazy import for livekit
livekit_service = None


def record_error(component: str, error_type: str):
    from viztrmeet.main import ERROR_COUNTER
    ERROR_COUNTER.labels(component=component, error_type=error_type).inc()


def set_active_sessions(count: int):
    from viztrmeet.main import ACTIVE_SESSIONS_GAUGE
    ACTIVE_SESSIONS_GAUGE.set(count)


@router.get("/token")
async def get_token(
    room_id: str = Query(...),
    participant_id: str = Query(...),
):
    payload = {
        "room_id": room_id,
        "participant_id": participant_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.ws_auth_secret, algorithm="HS256")
    return {"token": token, "ws_url": f"ws://localhost:8000/audio/stream"}


@router.get("/livekit/token")
async def get_livekit_token(
    room_id: str = Query(...),
    participant_id: str = Query(...),
    participant_name: str = Query(None),
    can_publish: bool = Query(True),
    can_subscribe: bool = Query(True),
    ttl_hours: int = Query(1),
):
    if not livekit_service.api_key or not livekit_service.api_secret:
        return {"error": "LiveKit not configured", "ws_url": ""}

    token = livekit_service.create_access_token(
        room_name=room_id,
        participant_identity=participant_id,
        participant_name=participant_name,
        can_publish=can_publish,
        can_subscribe=can_subscribe,
        ttl_hours=ttl_hours,
    )
    return {"token": token, "ws_url": settings.livekit_ws_url}


@router.websocket("/stream")
async def audio_stream(
    ws: WebSocket,
    room_id: str,
    participant_id: str,
    token: str,
    source_lang: str = "auto",
    target_lang: str = "en",
):
    connection_id = str(uuid.uuid4())

    try:
        claims = jwt.decode(token, settings.ws_auth_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        await ws.close(code=4001, reason="token expired")
        return
    except jwt.InvalidTokenError:
        await ws.close(code=4001, reason="invalid token")
        return

    if claims.get("room_id") != room_id or claims.get("participant_id") != participant_id:
        await ws.close(code=4001, reason="token does not match room/participant")
        return

    await ws.accept()

    session = VoxTRSession(
        room_id=room_id,
        participant_id=participant_id,
        source_lang=source_lang,
        target_lang=target_lang,
    )
    active_sessions[connection_id] = session
    set_active_sessions(len(active_sessions))

    async def send_json(payload):
        await ws.send_json(payload)

    async def send_bytes(data: bytes):
        await ws.send_bytes(data)

    try:
        from viztrmeet.services.audio_preprocessing import async_denoise_pcm16
        async for chunk in ws.iter_bytes():
            try:
                filtered_chunk = await async_denoise_pcm16(chunk)
                await process_chunk(session, filtered_chunk, send_json, send_bytes)
            except Exception as e:
                logger.warning("Chunk processing error", exc_info=e)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket error", exc_info=e)
        record_error("audio_stream", type(e).__name__)
    finally:
        session.cancel_tts_if_playing()
        active_sessions.pop(connection_id, None)
        set_active_sessions(len(active_sessions))