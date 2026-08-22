import asyncio

import pytest

from services.music_assistant.client import (
    MusicAssistantClient,
    match_uri,
    player_entry,
    search_query,
)


class FakeTrack:
    def __init__(self, track_name, artist_name):
        self.track_name = track_name
        self.artist_name = artist_name


def make_player(state="playing", elapsed=10.0, last_updated=1000.0):
    return {
        "player_id": "p1",
        "name": "Kitchen",
        "playback_state": state,
        "current_media": {
            "title": "Idioteque",
            "artist": "Radiohead",
            "album": "Kid A",
            "image_url": "http://ma/cover.jpg",
            "duration": 320.0,
            "elapsed_time": elapsed,
            "elapsed_time_last_updated": last_updated,
        },
    }


def test_player_entry_maps_media_to_dn_shape():
    entry = player_entry(make_player(), now=1000.0)
    assert entry.id == "ma:p1"
    assert entry.track_name == "Idioteque"
    assert entry.artist_name == "Radiohead"
    assert entry.album_name == "Kid A"
    assert entry.cover_url == "http://ma/cover.jpg"
    assert entry.device_name == "Kitchen"
    assert entry.source == "music-assistant"
    assert entry.is_paused is False
    assert entry.progress_ms == 10_000
    assert entry.duration_ms == 320_000


def test_player_entry_adds_drift_while_playing():
    entry = player_entry(make_player(), now=1005.0)
    assert entry.progress_ms == 15_000


def test_player_entry_does_not_drift_while_paused():
    entry = player_entry(make_player(state="paused"), now=1005.0)
    assert entry.is_paused is True
    assert entry.progress_ms == 10_000


def test_player_entry_skips_idle_and_empty_players():
    assert player_entry(make_player(state="idle")) is None
    idle = make_player()
    idle["current_media"] = {}
    assert player_entry(idle) is None


def test_apply_upserts_and_removes():
    client = MusicAssistantClient()
    client.apply({"event": "player_updated", "data": make_player()})
    assert len(client.snapshot()) == 1

    client.apply({"event": "player_updated", "data": make_player(state="idle")})
    assert client.snapshot() == []

    client.apply({"event": "player_updated", "data": make_player()})
    client.apply({"event": "player_removed", "data": {"player_id": "p1"}})
    assert client.snapshot() == []


def test_apply_ignores_frames_without_a_player():
    client = MusicAssistantClient()
    client.apply({"server_version": "2.9.13"})
    client.apply({"event": "queue_updated", "data": {"queue_id": "q1"}})
    assert client.snapshot() == []


def test_search_query_is_artist_then_title():
    assert search_query(FakeTrack("Idioteque", "Radiohead")) == "Radiohead Idioteque"


def test_match_uri_prefers_the_matching_artist():
    result = {
        "tracks": [
            {"uri": "spotify://track/wrong", "name": "Idioteque", "artists": [{"name": "Covers Inc"}]},
            {"uri": "library://track/42", "name": "Idioteque", "artists": [{"name": "Radiohead"}]},
        ]
    }
    assert match_uri(result, FakeTrack("Idioteque", "Radiohead")) == "library://track/42"


def test_match_uri_returns_none_when_no_title_matches():
    result = {"tracks": [{"uri": "library://track/9", "name": "Everything In Its Right Place", "artists": []}]}
    assert match_uri(result, FakeTrack("Idioteque", "Radiohead")) is None
    assert match_uri({}, FakeTrack("Idioteque", "Radiohead")) is None


class FakeMA(MusicAssistantClient):
    """Records every command instead of talking to MA."""

    def __init__(self, search_hits):
        super().__init__()
        self.calls = []
        self._search_hits = search_hits

    async def command(self, command, **args):
        self.calls.append((command, args))
        if command == "music/playlists/library_items":
            return []
        if command == "music/playlists/create_playlist":
            return {"item_id": "ma-pl-1", "name": args["name"]}
        if command == "music/playlists/playlist_tracks":
            return [{"position": 0}, {"position": 1}]
        if command == "music/search":
            return self._search_hits.get(args["search_query"], {})
        return None


def test_push_playlist_replaces_then_adds_resolved_uris():
    hits = {
        "Radiohead Idioteque": {
            "tracks": [{"uri": "library://track/42", "name": "Idioteque", "artists": [{"name": "Radiohead"}]}]
        }
    }
    client = FakeMA(hits)
    tracks = [FakeTrack("Idioteque", "Radiohead"), FakeTrack("Ghost Song", "Nobody")]

    result = asyncio.run(client.push_playlist("Late Night", tracks))

    assert result == {
        "playlist_id": "ma-pl-1",
        "pushed": 1,
        "missing": ["Nobody Ghost Song"],
    }
    commands = [c for c, _ in client.calls]
    assert commands.index("music/playlists/remove_playlist_tracks") < commands.index(
        "music/playlists/add_playlist_tracks"
    )
    remove_args = dict(client.calls)["music/playlists/remove_playlist_tracks"]
    assert remove_args == {"db_playlist_id": "ma-pl-1", "positions_to_remove": [0, 1]}
    add_args = dict(client.calls)["music/playlists/add_playlist_tracks"]
    assert add_args == {"db_playlist_id": "ma-pl-1", "uris": ["library://track/42"]}


def test_push_playlist_skips_add_when_nothing_resolves():
    client = FakeMA({})
    result = asyncio.run(client.push_playlist("Empty", [FakeTrack("X", "Y")]))
    assert result["pushed"] == 0
    assert "music/playlists/add_playlist_tracks" not in [c for c, _ in client.calls]


def test_snapshot_survives_a_bad_frame_mid_stream():
    client = MusicAssistantClient()
    client.apply({"event": "player_updated", "data": make_player()})
    client.apply({"event": "player_updated", "data": "not-a-dict"})
    assert len(client.snapshot()) == 1


@pytest.mark.parametrize("state", ["playing", "paused"])
def test_active_states_produce_entries(state):
    assert player_entry(make_player(state=state)) is not None
