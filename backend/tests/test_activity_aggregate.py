from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from core.exceptions import StaleRevisionError
from models.library_work import LibraryWorkItem, ScanRun
from services.activity_aggregate import build_activity, control_work_item
from services.cache_status_service import CacheSyncProgress


def _summary(active=0, held=0, failed=0):
    return SimpleNamespace(
        revision=1, active_count=active, held_count=held, failed_count=failed
    )


def _idle_cache():
    return CacheSyncProgress(
        is_syncing=False,
        phase=None,
        total_items=0,
        processed_items=0,
        current_item=None,
        started_at=None,
    )


def _running_scan():
    return LibraryWorkItem(
        id="run-1",
        kind="scan",
        state="indexing",
        phase="indexing",
        processed=25,
        total=100,
        unit="files",
        started_at=1000.0,
        updated_at=1100.0,
        new_count=4,
    )


def _recovery(needs_attention=2, cleanup=12):
    return LibraryWorkItem(
        id="recovery",
        kind="recovery",
        state="failed",
        phase="recovery",
        effect="attention",
        indeterminate=True,
        updated_at=900.0,
        failed_count=needs_attention,
        warning_count=cleanup,
    )


def test_running_scan_maps_to_progress_and_controls():
    response = build_activity(
        [_running_scan()], _summary(), _idle_cache(), [], set()
    )

    assert [item.id for item in response.running] == ["run-1"]
    item = response.running[0]
    assert item.progress == 25.0
    assert item.controls == ["pause", "stop"]
    assert item.title == "Updating the local library"
    assert "25 of 100 files" in item.facts
    assert item.started_at is not None


def test_indeterminate_work_reports_null_progress():
    item = LibraryWorkItem(
        id="op-1",
        kind="library_management",
        state="running",
        phase="planning",
        indeterminate=True,
        updated_at=10.0,
    )

    response = build_activity([item], _summary(), _idle_cache(), [], set())

    assert response.running[0].progress is None
    assert response.running[0].detail == "Working out what to change"


def test_recovery_splits_into_two_attention_items():
    response = build_activity([_recovery()], _summary(), _idle_cache(), [], set())

    ids = [item.id for item in response.attention]
    assert ids == ["recovery:moves", "recovery:cleanup"]
    moves, cleanup = response.attention
    assert moves.tier == "critical" and moves.dismissible is False
    assert cleanup.action_href == "/downloads?filter=cleanup"
    assert "12 finished downloads" in cleanup.why


def test_dismissed_items_are_hidden_but_recovery_moves_persist():
    response = build_activity(
        [_recovery()],
        _summary(),
        _idle_cache(),
        [],
        {"recovery:cleanup", "recovery:moves"},
    )

    assert [item.id for item in response.attention] == ["recovery:moves"]


def test_downloads_summary_row_and_failure_attention():
    response = build_activity(
        [], _summary(active=3, failed=2), _idle_cache(), [], set()
    )

    row = response.running[0]
    assert row.id == "downloads" and row.href == "/downloads"
    assert row.controls == ["retry"]
    assert any(item.id == "downloads:failed" for item in response.attention)


def test_cache_sync_appears_while_syncing():
    progress = CacheSyncProgress(
        is_syncing=True,
        phase="albums",
        total_items=200,
        processed_items=50,
        current_item="Abbey Road",
        started_at=5.0,
    )

    response = build_activity([], _summary(), progress, [], set())

    assert response.running[0].id == "cache-sync"
    assert response.running[0].progress == 25.0


def test_history_includes_terminal_scan_runs():
    run = ScanRun(
        id="run-old",
        kind="incremental",
        trigger="manual",
        state="completed",
        started_at=1.0,
        terminal_at=2.0,
        counters={"inspected_count": 40},
    )

    response = build_activity([], _summary(), _idle_cache(), [run], set())

    assert [item.id for item in response.history] == ["run-old"]
    assert response.history[0].state == "done"


@pytest.mark.asyncio
async def test_scan_control_resolves_revision_server_side():
    run = ScanRun(id="run-1", kind="incremental", trigger="manual", row_revision=7)
    coordinator = AsyncMock()
    coordinator.current.return_value = [run]
    coordinator.snapshot.return_value = SimpleNamespace(run=run)

    await control_work_item(
        "run-1",
        "pause",
        coordinator=coordinator,
        identification=AsyncMock(),
        operations=AsyncMock(),
        downloads=AsyncMock(),
        actor=SimpleNamespace(id="admin", role="admin"),
    )

    coordinator.control.assert_awaited_once_with("run-1", "pause", 7)


@pytest.mark.asyncio
async def test_stale_revision_retries_once_with_a_fresh_revision():
    run = ScanRun(id="run-1", kind="incremental", trigger="manual", row_revision=7)
    coordinator = AsyncMock()
    coordinator.current.return_value = [run]
    coordinator.snapshot.side_effect = [
        SimpleNamespace(run=run),
        SimpleNamespace(
            run=ScanRun(id="run-1", kind="incremental", trigger="manual", row_revision=8)
        ),
    ]
    coordinator.control.side_effect = [StaleRevisionError("stale"), None]

    await control_work_item(
        "run-1",
        "stop",
        coordinator=coordinator,
        identification=AsyncMock(),
        operations=AsyncMock(),
        downloads=AsyncMock(),
        actor=SimpleNamespace(id="admin", role="admin"),
    )

    assert coordinator.control.await_args_list[-1].args == ("run-1", "stop", 8)


@pytest.mark.asyncio
async def test_operation_control_falls_through_to_the_operation_service():
    coordinator = AsyncMock()
    coordinator.current.return_value = []
    operations = AsyncMock()
    operations.get.return_value = SimpleNamespace(row_revision=3)

    await control_work_item(
        "job-9",
        "resume",
        coordinator=coordinator,
        identification=AsyncMock(),
        operations=operations,
        downloads=AsyncMock(),
        actor=SimpleNamespace(id="admin", role="admin"),
    )

    operations.control.assert_awaited_once_with("job-9", "resume", 3)


@pytest.mark.asyncio
async def test_identification_pause_uses_the_control_revision():
    identification = AsyncMock()
    identification.activity_snapshot.return_value = {"control_revision": 4}

    await control_work_item(
        "identification",
        "pause",
        coordinator=AsyncMock(),
        identification=identification,
        operations=AsyncMock(),
        downloads=AsyncMock(),
        actor=SimpleNamespace(id="admin", role="admin"),
    )

    identification.pause.assert_awaited_once_with("admin", expected_revision=4)


@pytest.mark.asyncio
async def test_retry_is_refused_for_jobs_that_cannot_retry():
    coordinator = AsyncMock()
    coordinator.current.return_value = []

    with pytest.raises(Exception) as error:
        await control_work_item(
            "run-1",
            "retry",
            coordinator=coordinator,
            identification=AsyncMock(),
            operations=AsyncMock(),
            downloads=AsyncMock(),
            actor=SimpleNamespace(id="admin", role="admin"),
        )

    assert "cannot be retried" in str(error.value)
