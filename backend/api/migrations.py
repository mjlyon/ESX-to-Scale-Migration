from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.migration_job import JobStatus, MigrationJob
from backend.schemas.migration import (
    MigrationCreateRequest,
    MigrationJobResponse,
    MigrationStatsResponse,
)

router = APIRouter()


@router.post("", response_model=list[MigrationJobResponse])
async def create_migrations(
    req: MigrationCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    manager = request.app.state.migration_manager
    jobs: list[MigrationJob] = []

    for vm in req.vms:
        job = MigrationJob(
            vm_name=vm.name,
            vmware_host=req.vmware_host,
            vmware_user=req.vmware_user,
            vmware_connection_type=req.vmware_connection_type,
            vmware_insecure="true" if req.vmware_insecure else "false",
            vmware_vcenter_hint=req.vmware_vcenter_hint,
            scale_host=req.scale_host,
            scale_user=req.scale_user,
            scale_verify_tls="true" if req.scale_verify_tls else "false",
            status=JobStatus.PENDING,
        )
        db.add(job)
        jobs.append(job)

    await db.commit()
    for job in jobs:
        await db.refresh(job)

    if req.auto_start:
        for job in jobs:
            context = {
                "vmware_password": req.vmware_password,
                "scale_password": req.scale_password,
                "use_vddk": req.use_vddk,
            }
            await manager.submit_job(job.id, context)

    return jobs


@router.get("", response_model=list[MigrationJobResponse])
async def list_migrations(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(MigrationJob).order_by(MigrationJob.created_at.desc())
    if status:
        query = query.where(MigrationJob.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/stats", response_model=MigrationStatsResponse)
async def migration_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MigrationJob.status, func.count()).group_by(MigrationJob.status))
    counts = dict(result.all())
    active_statuses = {
        JobStatus.VALIDATING, JobStatus.FETCHING_CONFIG,
        JobStatus.CONVERTING, JobStatus.UPLOADING, JobStatus.CREATING_VM,
    }
    return MigrationStatsResponse(
        total=sum(counts.values()),
        pending=counts.get(JobStatus.PENDING, 0),
        active=sum(counts.get(s, 0) for s in active_statuses),
        completed=counts.get(JobStatus.COMPLETED, 0),
        failed=counts.get(JobStatus.FAILED, 0),
        cancelled=counts.get(JobStatus.CANCELLED, 0),
        paused=counts.get(JobStatus.PAUSED, 0),
    )


@router.get("/{job_id}", response_model=MigrationJobResponse)
async def get_migration(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/{job_id}/start")
async def start_migration(
    job_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    vmware_password: str = "",
    scale_password: str = "",
):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in (JobStatus.PENDING, JobStatus.PAUSED):
        raise HTTPException(400, f"Cannot start job in status '{job.status}'")

    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    vmware_password = body.get("vmware_password", vmware_password)
    scale_password = body.get("scale_password", scale_password)

    if not vmware_password or not scale_password:
        raise HTTPException(400, "Passwords required to start/resume")

    manager = request.app.state.migration_manager
    context = {
        "vmware_password": vmware_password,
        "scale_password": scale_password,
    }
    await manager.submit_job(job_id, context)
    return {"ok": True, "message": "Job started"}


@router.post("/{job_id}/pause")
async def pause_migration(job_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    manager = request.app.state.migration_manager
    await manager.pause_job(job_id)
    return {"ok": True, "message": "Pause requested"}


@router.post("/{job_id}/cancel")
async def cancel_migration(job_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    manager = request.app.state.migration_manager
    await manager.cancel_job(job_id)
    return {"ok": True, "message": "Cancel requested"}


@router.post("/{job_id}/retry")
async def retry_migration(
    job_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
        raise HTTPException(400, f"Cannot retry job in status '{job.status}'")

    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    vmware_password = body.get("vmware_password", "")
    scale_password = body.get("scale_password", "")

    if not vmware_password or not scale_password:
        raise HTTPException(400, "Passwords required to retry")

    # Reset status to pending
    await db.execute(
        update(MigrationJob)
        .where(MigrationJob.id == job_id)
        .values(
            status=JobStatus.PENDING,
            error_message="",
            progress_percent=0,
            progress_message="",
        )
    )
    await db.commit()

    manager = request.app.state.migration_manager
    context = {
        "vmware_password": vmware_password,
        "scale_password": scale_password,
    }
    await manager.submit_job(job_id, context)
    return {"ok": True, "message": "Retry started"}


@router.delete("/{job_id}")
async def delete_migration(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status in (
        JobStatus.VALIDATING, JobStatus.FETCHING_CONFIG,
        JobStatus.CONVERTING, JobStatus.UPLOADING, JobStatus.CREATING_VM,
    ):
        raise HTTPException(400, "Cannot delete a running job")
    await db.delete(job)
    await db.commit()
    return {"ok": True}


@router.get("/{job_id}/logs")
async def get_logs(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(MigrationJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.log_file or not os.path.exists(job.log_file):
        return {"lines": []}

    with open(job.log_file, "r") as f:
        lines = f.readlines()
    return {"lines": [line.rstrip("\n") for line in lines[-500:]]}
