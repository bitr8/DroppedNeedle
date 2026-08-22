"""Read-only Music Assistant surfaces: now-playing mirror, status, playlist push."""

import logging

import httpx
from fastapi import APIRouter, HTTPException

from api.v1.schemas.now_playing import NowPlayingSnapshot
from core.dependencies.type_aliases import PlaylistServiceDep
from core.exceptions import PlaylistNotFoundError
from infrastructure.msgspec_fastapi import AppStruct, MsgSpecRoute
from middleware import CurrentCuratorDep, CurrentUserDep
from services.music_assistant.client import get_music_assistant_client

logger = logging.getLogger(__name__)

router = APIRouter(
    route_class=MsgSpecRoute, prefix="/music-assistant", tags=["music-assistant"]
)


class MusicAssistantStatus(AppStruct):
    connected: bool
    url: str
    enabled: bool


class PlaylistPushResult(AppStruct):
    playlist_id: str
    pushed: int
    missing: list[str]


@router.get("/now-playing", response_model=NowPlayingSnapshot)
async def now_playing(current_user: CurrentUserDep) -> NowPlayingSnapshot:
    return NowPlayingSnapshot(sessions=get_music_assistant_client().snapshot())


@router.get("/status", response_model=MusicAssistantStatus)
async def status(current_user: CurrentUserDep) -> MusicAssistantStatus:
    client = get_music_assistant_client()
    return MusicAssistantStatus(
        connected=client.connected, url=client.url, enabled=client.enabled
    )


@router.post("/playlists/{playlist_id}/push", response_model=PlaylistPushResult)
async def push_playlist(
    playlist_id: str,
    current_user: CurrentCuratorDep,
    playlist_service: PlaylistServiceDep,
) -> PlaylistPushResult:
    client = get_music_assistant_client()
    if not client.enabled:
        raise HTTPException(status_code=503, detail="Music Assistant is not configured")

    try:
        detail = await playlist_service.get_playlist_with_tracks(
            playlist_id, current_user
        )
    except PlaylistNotFoundError:
        raise HTTPException(status_code=404, detail="Playlist not found")

    tracks = getattr(detail, "tracks", None)
    if tracks is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    try:
        result = await client.push_playlist(detail.record.name, tracks)
    except httpx.HTTPError as exc:
        logger.warning("music_assistant.push_failed", extra={"error": str(exc)})
        raise HTTPException(status_code=502, detail="Music Assistant rejected the push")

    return PlaylistPushResult(**result)
