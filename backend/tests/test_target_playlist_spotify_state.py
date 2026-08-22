import threading
from pathlib import Path

import pytest

from infrastructure.persistence.native_library_store import NativeLibraryStore
from services.native.target_reference_adapters import TargetPlaylistRepository


@pytest.fixture
def repository(tmp_path: Path) -> TargetPlaylistRepository:
    return TargetPlaylistRepository(
        NativeLibraryStore(tmp_path / "target.db", threading.Lock())
    )


@pytest.mark.asyncio
async def test_sync_state_round_trips_through_target_rows(
    repository: TargetPlaylistRepository,
) -> None:
    playlist = await repository.create_playlist(
        "Spotify Mix", source_ref="spotify:abc", user_id="user-1"
    )
    assert playlist.spotify_sync_status is None
    assert playlist.spotify_missing_count == 0

    await repository.set_spotify_sync_state(
        playlist.id,
        "synced",
        snapshot_id="snap-1",
        synced_at="2026-08-22T00:00:00+00:00",
        error=None,
        missing_count=3,
        track_hash="hash-1",
    )

    stored = await repository.get_playlist(playlist.id)
    assert stored is not None
    assert stored.spotify_sync_status == "synced"
    assert stored.spotify_snapshot_id == "snap-1"
    assert stored.spotify_synced_at == "2026-08-22T00:00:00+00:00"
    assert stored.spotify_sync_error is None
    assert stored.spotify_missing_count == 3
    assert stored.spotify_synced_track_hash == "hash-1"

    await repository.set_spotify_sync_state(playlist.id, "error", error="boom")
    stored = await repository.get_playlist(playlist.id)
    assert stored is not None
    assert stored.spotify_sync_status == "error"
    assert stored.spotify_sync_error == "boom"
    assert stored.spotify_snapshot_id == "snap-1"
    assert stored.spotify_missing_count == 3

    summary = await repository.get_summary(playlist.id)
    assert summary is not None
    assert summary.spotify_sync_status == "error"
    assert summary.spotify_synced_at == "2026-08-22T00:00:00+00:00"
    assert summary.spotify_missing_count == 3


@pytest.mark.asyncio
async def test_snapshot_update_and_linked_listing(
    repository: TargetPlaylistRepository,
) -> None:
    linked = await repository.create_playlist(
        "Spotify Mix", source_ref="spotify:abc", user_id="user-1"
    )
    await repository.create_playlist("Local", source_ref=None, user_id="user-1")
    await repository.create_playlist(
        "Plex Mix", source_ref="plex:1", user_id="user-1"
    )

    await repository.update_spotify_snapshot(linked.id, "snap-2")

    rows = await repository.get_spotify_synced_playlists()
    assert [row.id for row in rows] == [linked.id]
    assert rows[0].spotify_snapshot_id == "snap-2"


@pytest.mark.asyncio
async def test_detach_clears_link_once(repository: TargetPlaylistRepository) -> None:
    playlist = await repository.create_playlist(
        "Spotify Mix", source_ref="spotify:abc", user_id="user-1"
    )
    await repository.set_spotify_sync_state(
        playlist.id, "synced", snapshot_id="snap-1", error="stale", track_hash="hash"
    )

    assert await repository.detach_spotify(playlist.id) is True

    stored = await repository.get_playlist(playlist.id)
    assert stored is not None
    assert stored.source_ref is None
    assert stored.spotify_sync_status == "detached"
    assert stored.spotify_snapshot_id is None
    assert stored.spotify_sync_error is None
    assert stored.spotify_synced_track_hash is None
    assert await repository.get_spotify_synced_playlists() == []
    assert await repository.detach_spotify(playlist.id) is False


@pytest.mark.asyncio
async def test_unresolved_tracks_are_counted(
    repository: TargetPlaylistRepository,
) -> None:
    playlist = await repository.create_playlist(
        "Spotify Mix", source_ref="spotify:abc", user_id="user-1"
    )
    await repository.add_tracks(
        playlist.id,
        [
            {
                "track_name": "Missing",
                "artist_name": "Nobody",
                "album_name": "Nowhere",
                "source_type": "",
                "available_sources": [],
                "position": 0,
            },
            {
                "track_name": "Streamable",
                "artist_name": "Somebody",
                "album_name": "Somewhere",
                "source_type": "spotify",
                "available_sources": ["spotify"],
                "position": 1,
            },
        ],
    )

    assert await repository.count_unresolved_tracks(playlist.id) == 1
