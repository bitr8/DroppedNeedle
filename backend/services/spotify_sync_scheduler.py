"""Periodic Spotify mirror re-sync.

Polls each linked playlist's ``snapshot_id`` and only diff-syncs the ones that changed
(§8.4). Per-user auth is resolved inside SpotifyImportService: a user who never linked,
or whose token expired, is skipped and marked paused - the loop itself never dies.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_MINUTES = 60.0

_last_run: dict = {}


def get_last_run() -> dict:
    return dict(_last_run)


def _interval_minutes(preferences) -> float:
    try:
        raw = preferences.get_setting("spotify.sync_interval_minutes")
        value = float(raw)
    except (AttributeError, TypeError, ValueError, OSError):
        return DEFAULT_INTERVAL_MINUTES
    return value if value > 0 else DEFAULT_INTERVAL_MINUTES


def _record(results: list[dict], interval_minutes: float) -> None:
    now = datetime.now(timezone.utc)
    _last_run.update(
        {
            "last_run_at": now.isoformat(),
            "next_run_at": (now + timedelta(minutes=interval_minutes)).isoformat(),
            "interval_minutes": interval_minutes,
            "checked": len(results),
            "updated": sum(
                1 for r in results if r.get("status") in ("synced", "conflict")
            ),
            "failed": sum(
                1 for r in results if r.get("status") in ("error", "paused")
            ),
        }
    )


async def run_spotify_sync_loop(service_getter, preferences_getter=None) -> None:
    while True:
        interval = (
            DEFAULT_INTERVAL_MINUTES
            if preferences_getter is None
            else _interval_minutes(preferences_getter())
        )
        try:
            results = await service_getter().check_all_synced_playlists()
            _record(results, interval)
            logger.info(
                "spotify.sync_cycle",
                extra={k: v for k, v in _last_run.items() if k != "next_run_at"},
            )
        except asyncio.CancelledError:
            break
        except Exception as exc:  # noqa: BLE001
            logger.warning("Spotify sync cycle failed: %s", exc)
        await asyncio.sleep(interval * 60)
