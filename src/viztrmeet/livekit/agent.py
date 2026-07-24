from livekit import agents
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.plugins import silero
from viztrmeet.core.config import settings
from viztrmeet.core.session import VoxTRSession
from viztrmeet.core.pipeline import process_chunk
from viztrmeet.services.audio_preprocessing import async_denoise_pcm16
import uuid
import asyncio


class VizTRAgent(agents.Agent):
    def __init__(self):
        super().__init__(
            instructions="You are a real-time voice translation assistant. Process incoming audio, transcribe, translate, and synthesize speech.",
        )
        self.sessions = {}

    async def on_track_subscribed(self, track, publication, participant):
        if track.kind != "audio":
            return

        room_id = track.sid.split("-")[0] if "-" in track.sid else "default"
        participant_id = participant.identity

        if room_id not in self.sessions:
            self.sessions[room_id] = {}

        session = VoxTRSession(
            room_id=room_id,
            participant_id=participant_id,
            source_lang=participant.metadata.get("source_lang", "auto") if participant.metadata else "auto",
            target_lang=participant.metadata.get("target_lang", "en") if participant.metadata else "en",
        )
        self.sessions[room_id][participant_id] = session

        async def audio_handler(frame):
            if frame.data is None:
                return

            try:
                filtered = await async_denoise_pcm16(frame.data.tobytes())
                await process_chunk(
                    session,
                    filtered,
                    self.send_json,
                    self.send_audio,
                )
            except Exception as e:
                print(f"Audio processing error: {e}")

        track.on("frame", audio_handler)

    async def on_track_unsubscribed(self, track, publication, participant):
        room_id = track.sid.split("-")[0] if "-" in track.sid else "default"
        participant_id = participant.identity

        if room_id in self.sessions and participant_id in self.sessions[room_id]:
            session = self.sessions[room_id].pop(participant_id)
            session.cancel_tts_if_playing()

    async def send_json(self, payload):
        await self.publish_data(payload, reliable=True)

    async def send_audio(self, data: bytes):
        await self.publish_audio(data)

    async def on_data_received(self, data, participant):
        if isinstance(data, dict) and data.get("type") == "translation_request":
            await self.handle_translation_request(data, participant)


async def entrypoint(ctx: JobContext):
    agent = VizTRAgent()
    await ctx.connect()
    await agent.start(ctx.room)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=lambda: silero.VAD.load(),
        )
    )