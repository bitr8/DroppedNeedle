from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI

from api.v1.routes.activity import router
from core.dependencies import get_download_service
from core.dependencies.type_aliases import (
    get_cache_status_service,
    get_library_administrative_work_service,
    get_mb_provider_availability,
    get_target_identification_queue,
    get_target_library_scan_coordinator,
    get_target_library_operation_service,
)
from core.exceptions import StaleRevisionError
from models.library_work import LibraryWorkItem, ScanRun
from services.activity_dismissals import get_activity_dismissal_store
from services.cache_status_service import CacheSyncProgress
from tests.helpers import build_test_client, override_admin_auth


@pytest.fixture
def app() -> tuple[FastAPI, AsyncMock, AsyncMock]:
    application = FastAPI()
    application.include_router(router)
    override_admin_auth(application)

    run = ScanRun(
        id="run-1",
        kind="incremental",
        trigger="manual",
        state="indexing",
        phase="indexing",
        row_revision=5,
    )
    coordinator = AsyncMock()
    coordinator.current.return_value = [run]
    coordinator.history.return_value = []
    coordinator.snapshot.return_value = SimpleNamespace(
        run=run, counters={"total_count": 100, "inspected_count": 25}
    )

    identification = AsyncMock()
    identification.stream_revisions.return_value = {}
    identification.activity_snapshot.return_value = {
        "counts": {},
        "control_state": "running",
        "control_revision": 4,
        "claimable_count": 0,
        "foreground_operation_count": 0,
        "deferred_count": 0,
        "deferred_reason_counts": {},
        "attention_count": 0,
        "failure_event_id": None,
        "failure_at": None,
        "started_at": None,
        "updated_at": 0.0,
    }

    administrative_work = AsyncMock()
    administrative_work.active.return_value = [
        LibraryWorkItem(
            id="recovery",
            kind="recovery",
            state="failed",
            effect="attention",
            indeterminate=True,
            updated_at=10.0,
            failed_count=1,
            warning_count=12,
        )
    ]

    downloads = AsyncMock()
    downloads.get_activity_summary.return_value = SimpleNamespace(
        revision=1, active_count=2, held_count=0, failed_count=0
    )

    operations = AsyncMock()
    dismissals = AsyncMock()
    dismissals.dismissed.return_value = set()

    cache_status = Mock()
    cache_status.get_progress.return_value = CacheSyncProgress(
        is_syncing=False,
        phase=None,
        total_items=0,
        processed_items=0,
        current_item=None,
        started_at=None,
    )

    application.dependency_overrides.update(
        {
            get_target_library_scan_coordinator: lambda: coordinator,
            get_target_identification_queue: lambda: identification,
            get_library_administrative_work_service: lambda: administrative_work,
            get_mb_provider_availability: lambda: (lambda: True),
            get_cache_status_service: lambda: cache_status,
            get_target_library_operation_service: lambda: operations,
            get_download_service: lambda: downloads,
            get_activity_dismissal_store: lambda: dismissals,
        }
    )
    return application, coordinator, dismissals


def test_activity_returns_grouped_work(app):
    application, _, _ = app

    with build_test_client(application) as client:
        response = client.get("/activity")

    assert response.status_code == 200
    payload = response.json()
    assert {item["id"] for item in payload["running"]} >= {"run-1", "downloads"}
    assert [item["id"] for item in payload["attention"]] == [
        "recovery:moves",
        "recovery:cleanup",
    ]


def test_pause_resolves_the_revision_without_the_caller_sending_one(app):
    application, coordinator, _ = app

    with build_test_client(application) as client:
        response = client.post("/activity/run-1/pause")

    assert response.status_code == 202
    assert response.json() == {"ok": True}
    coordinator.control.assert_awaited_once_with("run-1", "pause", 5)


def test_conflict_returns_409_with_a_plain_reason(app):
    application, coordinator, _ = app
    coordinator.control.side_effect = StaleRevisionError(
        "That job changed while you were looking at it."
    )

    with build_test_client(application) as client:
        response = client.post("/activity/run-1/stop")

    assert response.status_code == 409
    assert "changed while you were looking at it" in response.json()["error"]["message"]


def test_unknown_verb_is_rejected(app):
    application, _, _ = app

    with build_test_client(application) as client:
        response = client.post("/activity/run-1/frobnicate")

    assert response.status_code == 404


def test_dismiss_persists_per_user(app):
    application, _, dismissals = app

    with build_test_client(application) as client:
        response = client.post("/activity/attention/recovery:cleanup/dismiss")

    assert response.status_code == 202
    dismissals.dismiss.assert_awaited_once_with("test-admin-id", "recovery:cleanup")
