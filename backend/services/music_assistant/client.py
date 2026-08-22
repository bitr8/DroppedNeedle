"""Music Assistant bridge: WebSocket now-playing mirror + REST playlist push.

MA is the playback hub; DN only reads its state. Commands and object shapes are the
live ones from ``http://<ma>:8095/api-docs/commands.json`` and ``/api-docs/openapi.json``
(MA 2.9.13, schema 31).
"""

import asyncio
import logging
import time
from typing import Any

import httpx
import websockets

from api.v1.schemas.now_playing import NowPlayingSnapshotEntry
from core.config import get_settings
from infrastructure.crypto import decrypt
from infrastructure.file_utils import read_json

logger = logging.getLogger(__name__)

SOURCE = "music-assistant"
_ACTIVE_STATES = ("playing", "paused")
_BACKOFF_MAX = 60.0


def load_config() -> tuple[str, bool, str]:
    """(url, enabled, token) from the ``music_assistant`` block of config.json."""
    settings = get_settings()
    raw = read_json(settings.config_file_path, default={}) or {}
    block = raw.get("music_assistant") or {}
    token = block.get("token") or ""
    if token:
        token, _ = decrypt(token)
    return str(block.get("url") or "").rstrip("/"), bool(block.get("enabled")), token


def _ms(value: Any) -> int | None:
    return None if value is None else int(float(value) * 1000)


def player_entry(player: dict[str, Any], now: float | None = None) -> NowPlayingSnapshotEntry | None:
    """Map an MA ``Player`` object to DN's now-playing entry, or None when idle."""
    media = player.get("current_media") or {}
    state = player.get("playback_state") or ""
    if state not in _ACTIVE_STATES or not media.get("title"):
        return None

    elapsed = media.get("elapsed_time")
    if elapsed is None:
        elapsed = player.get("elapsed_time")
    last_updated = media.get("elapsed_time_last_updated") or player.get(
        "elapsed_time_last_updated"
    )
    # MA reports elapsed_time as of last_updated; a playing track has drifted since
    if elapsed is not None and state == "playing" and last_updated:
        elapsed = float(elapsed) + max(0.0, (now if now is not None else time.time()) - float(last_updated))

    return NowPlayingSnapshotEntry(
        id=f"ma:{player.get('player_id', '')}",
        user_name="",
        track_name=media.get("title") or "",
        artist_name=media.get("artist") or "",
        album_name=media.get("album") or None,
        cover_url=media.get("image_url") or "",
        device_name=player.get("name") or player.get("player_id") or "",
        is_paused=state == "paused",
        source=SOURCE,
        progress_ms=_ms(elapsed),
        duration_ms=_ms(media.get("duration")),
    )


def search_query(track: Any) -> str:
    artist = getattr(track, "artist_name", "") or ""
    name = getattr(track, "track_name", "") or ""
    return f"{artist} {name}".strip()


def match_uri(result: dict[str, Any], track: Any) -> str | None:
    """Pick the MA track uri matching a DN playlist track, artist first then title."""
    want_title = (getattr(track, "track_name", "") or "").casefold().strip()
    want_artist = (getattr(track, "artist_name", "") or "").casefold().strip()
    fallback = None
    for item in result.get("tracks") or []:
        uri = item.get("uri")
        if not uri or (item.get("name") or "").casefold().strip() != want_title:
            continue
        artists = " ".join(
            (a.get("name") or "") for a in (item.get("artists") or [])
        ).casefold()
        if want_artist and want_artist in artists:
            return uri
        fallback = fallback or uri
    return fallback


class MusicAssistantClient:
    def __init__(self) -> None:
        self._players: dict[str, dict[str, Any]] = {}
        self._task: asyncio.Task | None = None
        self._connected = False
        self._url, self._enabled, self._token = "", False, ""

    @property
    def enabled(self) -> bool:
        return self._enabled and bool(self._url)

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def url(self) -> str:
        return self._url

    def snapshot(self) -> list[NowPlayingSnapshotEntry]:
        now = time.time()
        entries = (player_entry(p, now) for p in self._players.values())
        return [e for e in entries if e is not None]

    def apply(self, message: dict[str, Any]) -> None:
        """Fold one WebSocket frame into the player snapshot."""
        data = message.get("data")
        if not isinstance(data, dict):
            return
        player_id = data.get("player_id")
        if not player_id:
            return
        if "remove" in (message.get("event") or ""):
            self._players.pop(player_id, None)
        else:
            self._players[player_id] = data

    async def start(self) -> None:
        self._url, self._enabled, self._token = load_config()
        if not self.enabled:
            logger.info("music_assistant.disabled")
            return
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self._connected = False
        self._players.clear()

    async def _run(self) -> None:
        backoff = 1.0
        ws_url = self._url.replace("https://", "wss://").replace("http://", "ws://") + "/ws"
        headers = {"Authorization": f"Bearer {self._token}"} if self._token else {}
        while True:
            try:
                async with websockets.connect(ws_url, additional_headers=headers) as ws:
                    self._connected = True
                    backoff = 1.0
                    await self._seed_players()
                    async for raw in ws:
                        try:
                            self.apply(_decode(raw))
                        except Exception as exc:  # noqa: BLE001 - one bad frame must not drop the feed
                            logger.debug("music_assistant.bad_frame", extra={"error": str(exc)})
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - reconnect forever
                logger.warning("music_assistant.disconnected", extra={"error": str(exc)})
            self._connected = False
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, _BACKOFF_MAX)

    async def _seed_players(self) -> None:
        players = await self.command("players/all")
        if isinstance(players, list):
            self._players = {p["player_id"]: p for p in players if p.get("player_id")}

    async def command(self, command: str, **args: Any) -> Any:
        """Run an MA command over ``POST /api`` (same command set as the socket)."""
        headers = {"Authorization": f"Bearer {self._token}"} if self._token else {}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self._url}/api",
                json={"command": command, "args": args},
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def push_playlist(self, name: str, tracks: list[Any]) -> dict[str, Any]:
        """Create or replace an MA playlist from DN playlist tracks."""
        playlist = await self._find_or_create_playlist(name)
        playlist_id = playlist["item_id"]

        existing = await self.command(
            "music/playlists/playlist_tracks", item_id=playlist_id
        )
        if existing:
            await self.command(
                "music/playlists/remove_playlist_tracks",
                db_playlist_id=playlist_id,
                positions_to_remove=[t["position"] for t in existing if "position" in t],
            )

        uris, missing = [], []
        for track in tracks:
            result = await self.command(
                "music/search", search_query=search_query(track), media_types=["track"], limit=10
            )
            uri = match_uri(result or {}, track)
            (uris.append(uri) if uri else missing.append(search_query(track)))

        if uris:
            await self.command(
                "music/playlists/add_playlist_tracks", db_playlist_id=playlist_id, uris=uris
            )
        return {"playlist_id": playlist_id, "pushed": len(uris), "missing": missing}

    async def _find_or_create_playlist(self, name: str) -> dict[str, Any]:
        items = await self.command("music/playlists/library_items", search=name, limit=25)
        for item in items or []:
            if (item.get("name") or "").casefold() == name.casefold():
                return item
        return await self.command("music/playlists/create_playlist", name=name)


def _decode(raw: Any) -> dict[str, Any]:
    import msgspec

    return msgspec.json.decode(raw if isinstance(raw, bytes) else raw.encode())


_client: MusicAssistantClient | None = None


def get_music_assistant_client() -> MusicAssistantClient:
    global _client
    if _client is None:
        _client = MusicAssistantClient()
    return _client
