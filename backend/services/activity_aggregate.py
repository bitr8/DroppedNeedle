"""One activity view over the existing work registries, plus revision-less controls."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

import msgspec

from core.exceptions import ConflictError, StaleRevisionError
from infrastructure.msgspec_fastapi import AppStruct
from models.library_work import LibraryWorkItem, ScanRun
from services.cache_status_service import CacheSyncProgress


class WorkItem(AppStruct):
    id: str
    kind: str
    title: str
    state: str
    detail: str | None = None
    progress: float | None = None
    facts: list[str] = msgspec.field(default_factory=list)
    href: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    controls: list[str] = msgspec.field(default_factory=list)


class AttentionItem(AppStruct):
    id: str
    what: str
    why: str
    action_label: str
    action_href: str
    tier: str
    dismissible: bool = True


class ActivityResponse(AppStruct):
    running: list[WorkItem] = msgspec.field(default_factory=list)
    queued: list[WorkItem] = msgspec.field(default_factory=list)
    attention: list[AttentionItem] = msgspec.field(default_factory=list)
    history: list[WorkItem] = msgspec.field(default_factory=list)


class ActivityControlRefused(ConflictError):
    """Raised when a verb cannot apply to the addressed work item."""


_TITLES = {
    "scan": "Updating the local library",
    "identification": "Identifying albums",
    "identity_preparation": "Preparing albums for organising",
    "identity_review": "Reviewing album matches",
    "reidentification": "Re-identifying albums",
    "maintenance": "Repairing library metadata",
    "library_management": "Organising files",
    "recovery": "Interrupted file moves",
}

_HREFS = {
    "identification": "/review",
    "identity_review": "/review",
    "recovery": "/library/management/recovery",
}

_RUNNING_STATES = {
    "running",
    "claimed",
    "discovering",
    "indexing",
    "reconciling",
    "planning",
    "applying",
    "undoing",
    "restoring",
    "pausing",
    "stopping",
}
_DONE_STATES = {"completed", "succeeded"}
_OPERATION_KINDS = {
    "library_management",
    "maintenance",
    "identity_preparation",
    "identity_review",
    "reidentification",
}

_PHASE_WORDS = {
    "discovering": "Looking for files",
    "indexing": "Reading files",
    "reconciling": "Updating the catalogue",
    "planning": "Working out what to change",
    "applying": "Moving files",
    "undoing": "Undoing changes",
    "restoring": "Restoring files",
    "pausing": "Finishing the current item before pausing",
    "stopping": "Finishing the current item before stopping",
    "identifying_albums": "Matching albums to releases",
    "recovery": "Waiting for a decision",
}

_FACT_LABELS = (
    ("new_count", "new"),
    ("changed_count", "changed"),
    ("missing_count", "missing"),
    ("succeeded_count", "done"),
    ("failed_count", "failed"),
    ("warning_count", "with warnings"),
    ("blocked_count", "blocked"),
    ("skipped_count", "skipped"),
)


def _iso(value: float | None) -> str | None:
    if not value:
        return None
    return datetime.fromtimestamp(float(value), timezone.utc).isoformat()


def _state(item: LibraryWorkItem) -> str:
    if item.kind == "recovery" or item.effect == "attention":
        return "attention"
    if item.state in _RUNNING_STATES:
        return "running"
    if item.state == "paused":
        return "paused"
    if item.state == "queued":
        return "queued"
    if item.state in _DONE_STATES:
        return "done"
    if item.state == "failed":
        return "failed"
    return "waiting"


def _progress(item: LibraryWorkItem) -> float | None:
    if item.indeterminate or not item.total:
        return None
    return round(min(100.0, item.processed / item.total * 100), 1)


def _facts(item: LibraryWorkItem) -> list[str]:
    facts = []
    if item.total and not item.indeterminate:
        facts.append(f"{item.processed} of {item.total} {item.unit}")
    if item.remaining_count:
        facts.append(f"{item.remaining_count} waiting")
    facts.extend(
        f"{getattr(item, field)} {label}"
        for field, label in _FACT_LABELS
        if getattr(item, field)
    )
    if item.profile_name:
        facts.append(item.profile_name)
    if item.scope_label:
        facts.append(item.scope_label)
    return facts


def _controls(item: LibraryWorkItem, state: str) -> list[str]:
    if item.kind == "identification":
        return ["pause"] if state == "running" else ["resume"] if state == "paused" else []
    if item.kind == "scan" or item.kind in _OPERATION_KINDS:
        if state == "running":
            return ["pause", "stop"]
        if state == "paused":
            return ["resume", "stop"]
        if state == "queued":
            return ["stop"]
    return []


def _href(item: LibraryWorkItem) -> str | None:
    if item.kind in _HREFS:
        return _HREFS[item.kind]
    if item.kind == "scan":
        return f"/library/scans/{item.id}"
    if item.kind in _OPERATION_KINDS:
        return f"/library/management/operations/{item.id}"
    return None


def work_item(item: LibraryWorkItem) -> WorkItem:
    state = _state(item)
    phase = item.phase or item.state
    return WorkItem(
        id=item.id,
        kind=item.kind,
        title=_TITLES.get(item.kind, item.kind.replace("_", " ").capitalize()),
        state=state,
        detail=_PHASE_WORDS.get(phase, item.mode),
        progress=_progress(item),
        facts=_facts(item),
        href=_href(item),
        started_at=_iso(item.started_at),
        finished_at=_iso(item.failure_at) if state in {"failed", "attention"} else None,
        controls=_controls(item, state),
    )


def _scan_history_item(run: ScanRun) -> WorkItem:
    inspected = run.counters.get("inspected_count", 0)
    return WorkItem(
        id=run.id,
        kind="scan",
        title=_TITLES["scan"],
        state="done" if run.state in _DONE_STATES else "failed",
        detail=run.terminal_code,
        progress=100.0 if run.state in _DONE_STATES else None,
        facts=[f"{inspected} files"] if inspected else [],
        href=f"/library/scans/{run.id}",
        started_at=_iso(run.started_at),
        finished_at=_iso(run.terminal_at),
    )


def _downloads_item(summary) -> WorkItem | None:
    active = int(summary.active_count)
    failed = int(summary.failed_count)
    held = int(summary.held_count)
    if not (active or failed or held):
        return None
    facts = [
        f"{count} {label}"
        for count, label in ((active, "downloading"), (held, "held"), (failed, "failed"))
        if count
    ]
    return WorkItem(
        id="downloads",
        kind="downloads",
        title="Downloading music",
        state="running" if active else "waiting",
        detail=None,
        progress=None,
        facts=facts,
        href="/downloads",
        controls=["retry"] if failed else [],
    )


def _cache_sync_item(progress: CacheSyncProgress) -> WorkItem | None:
    if not progress.is_syncing:
        return None
    return WorkItem(
        id="cache-sync",
        kind="cache_sync",
        title="Syncing the music library cache",
        state="running",
        detail=progress.current_item or progress.phase,
        progress=float(progress.progress_percent) if progress.total_items else None,
        facts=[f"{progress.processed_items} of {progress.total_items} items"]
        if progress.total_items
        else [],
        href=None,
        started_at=_iso(progress.started_at),
    )


def _attention(items: list[LibraryWorkItem], summary) -> list[AttentionItem]:
    attention: list[AttentionItem] = []
    recovery = next((item for item in items if item.kind == "recovery"), None)
    needs_decision = recovery.failed_count if recovery else 0
    cleanup_pending = recovery.warning_count if recovery else 0
    if needs_decision:
        attention.append(
            AttentionItem(
                id="recovery:moves",
                what="Interrupted file moves",
                why=f"{needs_decision} albums stopped part-way through being moved "
                "and need a decision.",
                action_label="Review recovery",
                action_href="/library/management/recovery",
                tier="critical",
                dismissible=False,
            )
        )
    if cleanup_pending:
        attention.append(
            AttentionItem(
                id="recovery:cleanup",
                what="Source cleanup",
                why=f"{cleanup_pending} finished downloads still have leftover files "
                "in the download folder.",
                action_label="Review cleanup",
                action_href="/downloads?filter=cleanup",
                tier="warning",
            )
        )
    for item in items:
        if item.kind == "recovery" or item.effect != "attention":
            continue
        attention.append(
            AttentionItem(
                id=f"{item.kind}:{item.id}",
                what=_TITLES.get(item.kind, item.kind),
                why=(
                    f"{item.failed_count} items failed."
                    if item.failed_count
                    else "This stopped before it finished."
                ),
                action_label="Review",
                action_href=_href(item) or "/activity",
                tier="warning",
            )
        )
    if int(summary.failed_count):
        attention.append(
            AttentionItem(
                id="downloads:failed",
                what="Failed downloads",
                why=f"{summary.failed_count} downloads did not complete.",
                action_label="Review downloads",
                action_href="/downloads?filter=failed",
                tier="warning",
            )
        )
    return attention


def build_activity(
    work_items: list[LibraryWorkItem],
    summary,
    cache_progress: CacheSyncProgress,
    scan_history: list[ScanRun],
    dismissed: set[str],
) -> ActivityResponse:
    mapped = [work_item(item) for item in work_items]
    for extra in (_downloads_item(summary), _cache_sync_item(cache_progress)):
        if extra is not None:
            mapped.append(extra)
    running = [item for item in mapped if item.state in {"running", "paused", "waiting"}]
    queued = [item for item in mapped if item.state == "queued"]
    history = [item for item in mapped if item.state in {"done", "failed"}]
    history.extend(
        _scan_history_item(run)
        for run in scan_history
        if run.terminal_at is not None and run.id not in {item.id for item in mapped}
    )
    history.sort(key=lambda item: item.finished_at or "", reverse=True)
    attention = [
        item
        for item in _attention(work_items, summary)
        if not (item.dismissible and item.id in dismissed)
    ]
    return ActivityResponse(
        running=running, queued=queued, attention=attention, history=history
    )


async def _apply_with_revision(
    resolve: Callable[[], Awaitable[int]],
    apply: Callable[[int], Awaitable[object]],
) -> None:
    """Resolve the revision server-side; one retry covers a concurrent transition."""
    for attempt in (0, 1):
        revision = await resolve()
        try:
            await apply(revision)
            return
        except StaleRevisionError:
            if attempt:
                raise


async def control_work_item(
    item_id: str,
    verb: str,
    *,
    coordinator,
    identification,
    operations,
    downloads,
    actor,
) -> None:
    if item_id == "identification":
        if verb not in {"pause", "resume"}:
            raise ActivityControlRefused(
                "Album identification can only be paused or resumed."
            )

        async def resolve() -> int:
            snapshot = await identification.activity_snapshot()
            return int(snapshot["control_revision"])

        async def apply(revision: int):
            if verb == "pause":
                return await identification.pause(actor.id, expected_revision=revision)
            return await identification.resume(expected_revision=revision)

        await _apply_with_revision(resolve, apply)
        return

    if item_id == "downloads":
        if verb != "retry":
            raise ActivityControlRefused(
                "Downloads are controlled from the downloads page; only retry works here."
            )
        await downloads.retry_all_failed(actor.id, actor.role)
        return

    if verb == "retry":
        raise ActivityControlRefused("This job cannot be retried; start it again instead.")

    run = next(
        (run for run in await coordinator.current() if run.id == item_id),
        None,
    )
    if run is not None:
        await _apply_with_revision(
            lambda: _scan_revision(coordinator, item_id),
            lambda revision: coordinator.control(item_id, verb, revision),
        )
        return

    await _apply_with_revision(
        lambda: _operation_revision(operations, item_id),
        lambda revision: operations.control(item_id, verb, revision),
    )


async def _scan_revision(coordinator, run_id: str) -> int:
    snapshot = await coordinator.snapshot(run_id)
    return int(snapshot.run.row_revision)


async def _operation_revision(operations, job_id: str) -> int:
    operation = await operations.get(job_id)
    return int(operation.row_revision)
