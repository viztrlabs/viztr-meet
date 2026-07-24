from fastapi import APIRouter
from viztrmeet.core.session import active_sessions

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "active_sessions": len(active_sessions)}
