import pytest
from fastapi.testclient import TestClient
from viztrmeet.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "VizTR Meet Running"
    assert "version" in data


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "active_sessions" in data


def test_token_endpoint():
    response = client.get("/audio/token?room_id=test&participant_id=user1")
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert "ws_url" in data
    assert data["ws_url"].startswith("ws://")


def test_websocket_connection():
    with client.websocket_connect("/audio/stream?room_id=test&participant_id=user1&token=invalid&source_lang=en&target_lang=en") as ws:
        ws.close()


class TestSettings:
    def test_default_settings(self):
        from viztrmeet.core.config import settings
        assert settings.asr_provider == "faster_whisper"
        assert settings.translation_provider == "ollama"
        assert settings.tts_provider == "edge_tts"


class TestSession:
    def test_session_creation(self):
        from viztrmeet.core.session import VoxTRSession
        session = VoxTRSession(
            room_id="room1",
            participant_id="user1",
            source_lang="en",
            target_lang="es",
        )
        assert session.room_id == "room1"
        assert session.participant_id == "user1"
        assert session.source_lang == "en"
        assert session.target_lang == "es"

    def test_append_audio(self):
        from viztrmeet.core.session import VoxTRSession
        session = VoxTRSession(
            room_id="room1",
            participant_id="user1",
            source_lang="en",
            target_lang="es",
        )
        session.append_audio(b"test audio")
        assert len(session.audio_buffer) > 0


class TestPipeline:
    @pytest.mark.asyncio
    async def test_process_chunk(self):
        from viztrmeet.core.session import VoxTRSession
        from viztrmeet.core.pipeline import process_chunk

        session = VoxTRSession(
            room_id="room1",
            participant_id="user1",
            source_lang="auto",
            target_lang="en",
        )

        async def send_json(payload):
            pass

        async def send_bytes(data):
            pass

        await process_chunk(session, b"test audio", send_json, send_bytes)