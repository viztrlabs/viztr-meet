import os
from datetime import timedelta
from typing import Optional
from livekit import api
from viztrmeet.core.config import settings


class LiveKitService:
    def __init__(self):
        self.api_key = settings.livekit_api_key
        self.api_secret = settings.livekit_api_secret
        self.ws_url = settings.livekit_ws_url

        if self.api_key and self.api_secret:
            self.room_client = api.LiveKitAPI(
                url=self.ws_url.replace("ws://", "http://").replace("wss://", "https://"),
                api_key=self.api_key,
                api_secret=self.api_secret,
            )
        else:
            self.room_client = None

    def create_access_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: Optional[str] = None,
        can_publish: bool = True,
        can_subscribe: bool = True,
        can_publish_data: bool = True,
        ttl_hours: int = 1,
    ) -> str:
        if not self.api_key or not self.api_secret:
            raise RuntimeError("LiveKit credentials not configured")

        grants = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=can_publish,
            can_subscribe=can_subscribe,
            can_publish_data=can_publish_data,
        )

        token = api.AccessToken(self.api_key, self.api_secret) \
            .with_identity(participant_identity) \
            .with_name(participant_name or participant_identity) \
            .with_grants(grants) \
            .with_ttl(timedelta(hours=ttl_hours))

        return token.to_jwt()

    async def remove_participant(self, room_name: str, identity: str) -> bool:
        if not self.room_client:
            return False
        await self.room_client.room.remove_participant(
            api.RoomParticipantIdentity(room=room_name, identity=identity)
        )
        return True

    async def mute_track(self, room_name: str, identity: str, track_sid: str, muted: bool) -> bool:
        if not self.room_client:
            return False
        await self.room_client.room.mute_track(
            api.MuteTrackRequest(
                room=room_name,
                identity=identity,
                track_sid=track_sid,
                muted=muted,
            )
        )
        return True

    async def get_active_rooms(self) -> list:
        if not self.room_client:
            return []
        rooms = await self.room_client.room.list_rooms(api.ListRoomsRequest())
        return rooms.rooms


livekit_service = LiveKitService()