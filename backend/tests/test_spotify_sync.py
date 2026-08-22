"""Background Spotify re-sync: snapshot gate, conflict, paused, detach (§8.4-8.7).

Runs against a real SQLite playlist repo (so the sync-state migration is exercised)
with a faked Spotify client - no network.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from repositories.async_playlist_repository import AsyncPlaylistRepository
from repositories.playlist_repository import PlaylistRepository
from services.spotify_import_service import (
    SpotifyImportService,
    SpotifyNotLinkedError,
    _fingerprint,
)
from services.spotify_sync_scheduler import (
    DEFAULT_INTERVAL_MINUTES,
    _interval_minutes,
)

SPOTIFY_ID = "spot-1"


def _track(name: str) -> dict:
    return {
        "name": name,
        "artists": [{"name": "Artist"}],
        "album": {"name": "Album", "images": []},
        "duration_ms": 200000,
    }


def _client(snapshot: str, tracks: list[dict] | None = None) -> AsyncMock:
    client = AsyncMock()
    client.get_playlist = AsyncMock(
        return_value={"id": SPOTIFY_ID, "snapshot_id": snapshot}
    )
    client.get_playlist_tracks = AsyncMock(return_value=tracks or [_track("One")])
    return client


@pytest.fixture
def repo(tmp_path) -> PlaylistRepository:
    return PlaylistRepository(db_path=tmp_path / "playlists.db")


def _service(repo: PlaylistRepository, client) -> SpotifyImportService:
    factory = AsyncMock()
    factory.resolve_spotify = AsyncMock(return_value=client)
    return SpotifyImportService(
        client_factory=factory,
        playlist_repo=None,
        mb_repo=AsyncMock(),
        playlist_service=MagicMock(),
        async_playlist_repo=AsyncPlaylistRepository(repo),
    )


def _linked(repo: PlaylistRepository, snapshot: str | None = None):
    playlist = repo.create_playlist(
        "Roadtrip", source_ref=f"spotify:{SPOTIFY_ID}", user_id="user-1"
    )
    if snapshot:
        repo.add_tracks(
            playlist.id,
            [{"track_name": "One", "artist_name": "Artist",
              "album_name": "Album", "source_type": ""}],
        )
        repo.set_spotify_sync_state(
            playlist.id,
            "synced",
            snapshot_id=snapshot,
            synced_at="2026-08-01T00:00:00+00:00",
            track_hash=_fingerprint([("Artist", "One")]),
        )
    return playlist


@pytest.mark.asyncio
async def test_unchanged_snapshot_skips_the_diff(repo):
    playlist = _linked(repo, snapshot="snap-1")
    client = _client("snap-1")
    svc = _service(repo, client)

    result = await svc.sync_playlist("user-1", SPOTIFY_ID, playlist.id)

    assert result["status"] == "unchanged"
    client.get_playlist_tracks.assert_not_called()


@pytest.mark.asyncio
async def test_changed_snapshot_resyncs_and_records_status(repo):
    playlist = _linked(repo, snapshot="snap-1")
    client = _client("snap-2", [_track("Two"), _track("Three")])
    svc = _service(repo, client)

    result = await svc.sync_playlist("user-1", SPOTIFY_ID, playlist.id)

    assert result["status"] == "synced"
    client.get_playlist_tracks.assert_awaited_once()
    stored = repo.get_playlist(playlist.id)
    assert stored.spotify_snapshot_id == "snap-2"
    assert stored.spotify_synced_at
    assert stored.spotify_missing_count == 2
    assert [t.track_name for t in repo.get_tracks(playlist.id)] == ["Two", "Three"]


@pytest.mark.asyncio
async def test_local_edit_since_last_sync_is_reported_as_conflict(repo):
    playlist = _linked(repo, snapshot="snap-1")
    repo.add_tracks(
        playlist.id,
        [{"track_name": "Local pick", "artist_name": "Artist",
          "album_name": "Album", "source_type": "local"}],
    )
    svc = _service(repo, _client("snap-2"))

    result = await svc.sync_playlist("user-1", SPOTIFY_ID, playlist.id)

    assert result["status"] == "conflict"
    assert repo.get_playlist(playlist.id).spotify_sync_status == "conflict"


@pytest.mark.asyncio
async def test_unreachable_spotify_pauses_the_playlist(repo):
    playlist = _linked(repo, snapshot="snap-1")
    svc = _service(repo, client=None)  # resolve_spotify -> None: not linked

    with pytest.raises(SpotifyNotLinkedError):
        await svc.sync_playlist("user-1", SPOTIFY_ID, playlist.id)

    stored = repo.get_playlist(playlist.id)
    assert stored.spotify_sync_status == "paused"
    assert stored.spotify_sync_error == "spotify_unreachable"


@pytest.mark.asyncio
async def test_network_failure_pauses_and_the_sweep_never_raises(repo):
    _linked(repo, snapshot="snap-1")
    client = _client("snap-2")
    client.get_playlist = AsyncMock(side_effect=OSError("connection reset"))
    svc = _service(repo, client)

    results = await svc.check_all_synced_playlists()

    assert [r["status"] for r in results] == ["paused"]
    stored = repo.get_spotify_synced_playlists()[0]
    assert stored.spotify_sync_status == "paused"
    assert stored.spotify_sync_error == "spotify_unreachable"


@pytest.mark.asyncio
async def test_sweep_only_syncs_changed_playlists(repo):
    _linked(repo, snapshot="snap-1")
    client = _client("snap-1")
    svc = _service(repo, client)

    results = await svc.check_all_synced_playlists()

    assert [r["status"] for r in results] == ["unchanged"]
    client.get_playlist_tracks.assert_not_called()


def test_detach_keeps_tracks_and_clears_the_link(repo):
    playlist = _linked(repo, snapshot="snap-1")

    assert repo.detach_spotify(playlist.id) is True

    stored = repo.get_playlist(playlist.id)
    assert stored.source_ref is None
    assert stored.spotify_snapshot_id is None
    assert stored.spotify_sync_status == "detached"
    assert len(repo.get_tracks(playlist.id)) == 1
    assert repo.get_spotify_synced_playlists() == []
    assert repo.detach_spotify(playlist.id) is False


def test_interval_falls_back_to_the_default_when_unset():
    prefs = MagicMock()
    prefs.get_setting.return_value = None
    assert _interval_minutes(prefs) == DEFAULT_INTERVAL_MINUTES
    prefs.get_setting.return_value = 15
    assert _interval_minutes(prefs) == 15.0
