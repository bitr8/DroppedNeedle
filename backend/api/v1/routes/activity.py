"""Aggregated activity feed with revision-less controls (admin only)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.v1.routes.library_scan_target import library_activity
from core.dependencies import get_download_service
from core.dependencies.type_aliases import (
    CacheStatusServiceDep,
    LibraryAdministrativeWorkServiceDep,
    LibraryOperationServiceDep,
    MbProviderAvailabilityDep,
    TargetIdentificationQueueDep,
    TargetLibraryScanCoordinatorDep,
)
from core.exceptions import ConflictError, ResourceNotFoundError, ValidationError
from infrastructure.msgspec_fastapi import MsgSpecRoute
from middleware import CurrentAdminDep
from services.activity_aggregate import (
    ActivityResponse,
    build_activity,
    control_work_item,
)
from services.activity_dismissals import (
    ActivityDismissalStore,
    get_activity_dismissal_store,
)

router = APIRouter(route_class=MsgSpecRoute, prefix="/activity", tags=["activity"])

_VERBS = {"pause", "resume", "stop", "retry"}


@router.get("", response_model=ActivityResponse)
async def activity(
    admin: CurrentAdminDep,
    coordinator: TargetLibraryScanCoordinatorDep,
    identification: TargetIdentificationQueueDep,
    administrative_work: LibraryAdministrativeWorkServiceDep,
    mb_provider_available: MbProviderAvailabilityDep,
    cache_status: CacheStatusServiceDep,
    downloads=Depends(get_download_service),
    dismissals: ActivityDismissalStore = Depends(get_activity_dismissal_store),
) -> ActivityResponse:
    library = await library_activity(
        admin, coordinator, identification, administrative_work, mb_provider_available
    )
    summary = await downloads.get_activity_summary(admin.id, admin.role)
    return build_activity(
        library.work_items,
        summary,
        cache_status.get_progress(),
        await coordinator.history(limit=20),
        await dismissals.dismissed(admin.id),
    )


@router.post("/attention/{item_id}/dismiss", status_code=202)
async def dismiss_attention(
    item_id: str,
    admin: CurrentAdminDep,
    dismissals: ActivityDismissalStore = Depends(get_activity_dismissal_store),
) -> dict[str, bool]:
    await dismissals.dismiss(admin.id, item_id)
    return {"ok": True}


@router.post("/{item_id}/{verb}", status_code=202)
async def control(
    item_id: str,
    verb: str,
    admin: CurrentAdminDep,
    coordinator: TargetLibraryScanCoordinatorDep,
    identification: TargetIdentificationQueueDep,
    operations: LibraryOperationServiceDep,
    downloads=Depends(get_download_service),
) -> dict[str, bool]:
    if verb not in _VERBS:
        raise HTTPException(
            status_code=404, detail=f"'{verb}' is not something you can do to a job."
        )
    try:
        await control_work_item(
            item_id,
            verb,
            coordinator=coordinator,
            identification=identification,
            operations=operations,
            downloads=downloads,
            actor=admin,
        )
    except ResourceNotFoundError:
        raise HTTPException(
            status_code=409,
            detail="That job has already finished or is no longer running.",
        ) from None
    except (ConflictError, ValidationError) as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    return {"ok": True}
