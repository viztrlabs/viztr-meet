import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from viztrmeet.main import app
from viztrmeet.core.config import Settings
from viztrmeet.core.session import VoxTRSession, active_sessions
from viztrmeet.services.audio_preprocessing import denoise_pcm16
from viztrmeet.services.registry import (
    transcribe_with_failover,
    translate_with_provider,
    get_tts_provider,
    ASR_PROVIDERS,
    TRANSLATE_PROVIDERS,
    TTS_PROVIDERS,
)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def clear_sessions():
    active_sessions.clear()
    yield
    active_sessions.clear()


class TestHealthEndpoint:
    async def test_health_ok(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "active_sessions" in data

    async def test_root_endpoint(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "VizTR Meet Running"
        assert "version" in data


class TestTokenEndpoint:
    async def test_token_creation(self, client):
        resp = await client.get("/audio/token", params={
            "room_id": "test-room",
            "participant_id": "test-user"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "ws_url" in data
        assert data["ws_url"].startswith("ws://")

    async def test_token_contains_claims(self, client):
        resp = await client.get("/audio/token", params={
            "room_id": "room-1",
            "participant_id": "user-1"
        })
        data = resp.json()
        import jwt
        from viztrmeet.core.config import settings
        decoded = jwt.decode(data["token"], settings.ws_auth_secret, algorithms=["HS256"])
        assert decoded["room_id"] == "room-1"
        assert decoded["participant_id"] == "user-1"
        assert "exp" in decoded


class TestVoxTRSession:
    def test_session_creation(self):
        session = VoxTRSession(
            room_id="room-1",
            participant_id="user-1",
            source_lang="en",
            target_lang="es"
        )
        assert session.room_id == "room-1"
        assert session.participant_id == "user-1"
        assert session.source_lang == "en"
        assert session.target_lang == "es"
        assert session.audio_buffer == bytearray()

    def test_append_audio(self):
        session = VoxTRSession("room-1", "user-1", "en", "es")
        session.append_audio(b"test audio data")
        assert len(session.audio_buffer) == len(b"test audio data")

    def test_cancel_tts(self):
        session = VoxTRSession("room-1", "user-1", "en", "es")
        session.cancel_tts_if_playing()  # Should not raise


class TestAudioPreprocessing:
    def test_denoise_returns_original_when_disabled(self):
        # Settings default has noise filter enabled, but without numpy it returns original
        audio = b"\x00\x00" * 1000
        result = denoise_pcm16(audio)
        assert result == audio


class TestRegistry:
    def test_asr_providers_defined(self):
        assert "faster_whisper" in ASR_PROVIDERS
        assert "deepgram" in ASR_PROVIDERS

    def test_translate_providers_defined(self):
        assert "ollama" in TRANSLATE_PROVIDERS
        assert "openrouter" in TRANSLATE_PROVIDERS

    def test_tts_providers_defined(self):
        assert "edge_tts" in TTS_PROVIDERS
        assert "voicebox" in TTS_PROVIDERS

    @pytest.mark.asyncio
    async def test_transcribe_with_failover(self):
        result = await transcribe_with_failover(b"audio", "en")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_translate_with_provider(self):
        result = await translate_with_provider("hello", "en", "es")
        assert isinstance(result, str)
        assert "translated" in result.lower()

    def test_get_tts_provider(self):
        provider = get_tts_provider()
        assert provider in ("edge_tts", "voicebox")


class TestSettings:
    def test_default_settings(self):
        settings = Settings()
        assert settings.asr_provider == "faster_whisper"
        assert settings.translation_provider == "ollama"
        assert settings.tts_provider == "edge_tts"
        assert settings.vad_threshold == 0.5
        assert settings.enable_noise_filter is True