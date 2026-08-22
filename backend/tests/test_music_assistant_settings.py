"""Music Assistant settings round-trip: token encrypted at rest, masked on read."""

import msgspec
import pytest

from api.v1.routes import settings as settings_routes
from api.v1.routes.settings import (
    MUSIC_ASSISTANT_TOKEN_MASK,
    MusicAssistantSettingsUpdate,
    MusicAssistantTestRequest,
    get_music_assistant_settings,
    test_music_assistant_connection as probe_route,
    update_music_assistant_settings,
)
from core.config import get_settings
from infrastructure.crypto import decrypt
from infrastructure.file_utils import read_json
from services.preferences_service import PreferencesService

TOKEN = "ma-token-for-tests"


class FakeClient:
    def __init__(self) -> None:
        self.restarts = 0

    async def restart(self) -> None:
        self.restarts += 1


@pytest.fixture
def prefs(tmp_path, monkeypatch):
    app_settings = get_settings()
    monkeypatch.setattr(app_settings, "config_file_path", tmp_path / "config.json")
    return PreferencesService(app_settings)


@pytest.fixture
def client(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(settings_routes, "get_music_assistant_client", lambda: fake)
    return fake


async def save(prefs, **kwargs):
    return await update_music_assistant_settings(
        MusicAssistantSettingsUpdate(**kwargs), prefs
    )


@pytest.mark.asyncio
async def test_put_encrypts_token_and_get_masks_it(prefs, client):
    await save(prefs, url="http://ma:8095/", enabled=True, token=TOKEN)

    stored = read_json(prefs._config_path, default={})["music_assistant"]
    assert stored["url"] == "http://ma:8095"
    assert stored["token"] != TOKEN
    assert decrypt(stored["token"])[0] == TOKEN
    assert client.restarts == 1

    read = await get_music_assistant_settings(prefs)
    assert read.url == "http://ma:8095"
    assert read.enabled is True
    assert read.token_set is True
    assert TOKEN not in msgspec.json.encode(read).decode()


@pytest.mark.asyncio
@pytest.mark.parametrize("token", [None, MUSIC_ASSISTANT_TOKEN_MASK])
async def test_omitted_or_masked_token_keeps_the_stored_one(prefs, client, token):
    await save(prefs, url="http://ma:8095", enabled=True, token=TOKEN)
    await save(prefs, url="http://ma:8095", enabled=False, token=token)

    stored = read_json(prefs._config_path, default={})["music_assistant"]
    assert decrypt(stored["token"])[0] == TOKEN
    assert stored["enabled"] is False


@pytest.mark.asyncio
async def test_empty_token_clears_it(prefs, client):
    await save(prefs, url="http://ma:8095", enabled=True, token=TOKEN)
    await save(prefs, url="http://ma:8095", enabled=True, token="")

    assert read_json(prefs._config_path, default={})["music_assistant"]["token"] == ""
    assert (await get_music_assistant_settings(prefs)).token_set is False


@pytest.mark.asyncio
async def test_enabled_without_url_is_rejected(prefs, client):
    with pytest.raises(Exception) as excinfo:
        await save(prefs, url="", enabled=True)
    assert excinfo.value.status_code == 400


@pytest.mark.asyncio
async def test_test_endpoint_uses_stored_token_when_omitted(prefs, client, monkeypatch):
    await save(prefs, url="http://ma:8095", enabled=True, token=TOKEN)
    seen = {}

    async def fake_probe(url, token, timeout=6.0):
        seen.update(url=url, token=token)
        return True, "Connected to Music Assistant 2.9.13", "2.9.13"

    monkeypatch.setattr(settings_routes, "ma_test_connection", fake_probe)

    result = await probe_route(MusicAssistantTestRequest(), prefs)
    assert seen == {"url": "http://ma:8095", "token": TOKEN}
    assert result.ok is True
    assert result.server_version == "2.9.13"


@pytest.mark.asyncio
async def test_test_endpoint_reports_rejected_token(prefs, client, monkeypatch):
    async def fake_probe(url, token, timeout=6.0):
        assert token == "supplied"
        return False, "Music Assistant rejected the token", "2.9.13"

    monkeypatch.setattr(settings_routes, "ma_test_connection", fake_probe)

    result = await probe_route(
        MusicAssistantTestRequest(url="http://ma:8095", token="supplied"), prefs
    )
    assert result.ok is False
    assert "rejected" in result.message


@pytest.mark.asyncio
async def test_test_endpoint_rejects_bad_url(prefs, client):
    result = await probe_route(
        MusicAssistantTestRequest(url="ftp://ma:8095"), prefs
    )
    assert result.ok is False
    assert "http" in result.message
