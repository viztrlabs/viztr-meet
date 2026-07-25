import os
from datetime import timedelta
from typing import Optional

try:
    from livekit import api
    LIVEKIT_AVAILABLE = True
except ImportError:
    LIVEKIT_AVAILABLE = False
    api = None

from viztrmeet.core.config import settings


class LiveKitService:
    def __init__(self):
        self.api_key = settings.livekit_api_key
        self.api_secret = settings.livekit_api_secret
        self.ws_url = settings.livekit_ws_url

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
        if not LIVEKIT_AVAILABLE or not api:
            raise RuntimeError("LiveKit not available - install livekit package")
        if not self.api_key or not self.api_secret:
            raise RuntimeError("LiveKit credentials not configured")

        grants = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=can_publish,
            can_subscribe=can_subscribe,
            can_publish_data=True,
        )

        token = api.AccessToken(self.api_key, self.api_secret) \
            .with_identity(participant_identity) \
            .with_name(participant_name or participant_identity) \
            .with_grants(grants) \
            .with_ttl(timedelta(hours=ttl_hours))

        return token.to_jwt()


livekit_service = LiveKitService()