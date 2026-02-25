from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy import update

from backend.config import settings
from backend.database import async_session
from backend.engine.scale_client import ScaleClient
from backend.engine.stages.base import BaseStage
from backend.engine.stages.cleanup import CleanupStage
from backend.engine.stages.fetch_vm_config import FetchVmConfigStage
from backend.engine.stages.scale_create_vm import ScaleCreateVmStage
from backend.engine.stages.scale_upload import ScaleUploadStage
from backend.engine.stages.validate_vmware import ValidateVmwareStage
from backend.engine.stages.virtv2v_convert import VirtV2VConvertStage
from backend.engine.vmware_client import VmwareClient
from backend.models.migration_job import JobStatus, MigrationJob
from backend.services.notification import ws_manager


class MigrationWorker:
    """Executes a single migration job through its stages."""

    def __init__(self, job_id: int, context: dict, on_done: Callable):
        self.job_id = job_id
        self.context = context
        self.on_done = on_done
        self._current_stage: BaseStage | None = None
        self._log_file = None

    async def run(self):
        try:
            job = await self._load_job()
            if not job:
                return

            self._setup_context(job)
            self._open_log_file()

            await self._update_db(
                status=JobStatus.VALIDATING,
                started_at=datetime.now(timezone.utc),
                log_file=self.context.get("log_file_path", ""),
            )

            stages = self._get_stages(job)

            for stage in stages:
                self._current_stage = stage
                await self._update_db(
                    current_stage=stage.name,
                    status=stage.name,
                )
                await ws_manager.broadcast_job_update(self.job_id, {
                    "status": stage.name,
                    "current_stage": stage.name,
                    "progress_percent": 0,
                    "progress_message": stage.description,
                })

                success = await stage.execute()

                if not success:
                    error = self.context.get("error", "Unknown error")
                    await self._update_db(
                        status=JobStatus.FAILED,
                        error_message=error,
                    )
                    await ws_manager.broadcast_job_update(self.job_id, {
                        "status": JobStatus.FAILED,
                        "error_message": error,
                    })
                    return

                await self._mark_stage_complete(stage)

            await self._update_db(
                status=JobStatus.COMPLETED,
                completed_at=datetime.now(timezone.utc),
                progress_percent=100,
                progress_message="Migration completed successfully",
                scale_vm_uuid=self.context.get("scale_vm_uuid", ""),
            )
            await ws_manager.broadcast_job_update(self.job_id, {
                "status": JobStatus.COMPLETED,
                "progress_percent": 100,
                "progress_message": "Migration completed successfully",
            })

        except Exception as e:
            await self._update_db(
                status=JobStatus.FAILED,
                error_message=str(e),
            )
            await ws_manager.broadcast_job_update(self.job_id, {
                "status": JobStatus.FAILED,
                "error_message": str(e),
            })
        finally:
            self._close_log_file()
            vmware_client = self.context.get("vmware_client")
            if vmware_client:
                vmware_client.cleanup()
            await self.on_done(self.job_id)

    def _setup_context(self, job: MigrationJob):
        vmware_pass = self.context.get("vmware_password", "")
        scale_pass = self.context.get("scale_password", "")

        vmware_client = VmwareClient(
            host=job.vmware_host,
            username=job.vmware_user,
            password=vmware_pass,
            connection_type=job.vmware_connection_type,
            insecure=job.vmware_insecure == "true",
            vcenter_hint=job.vmware_vcenter_hint,
        )
        scale_client = ScaleClient(
            host=job.scale_host,
            username=job.scale_user,
            password=scale_pass,
            verify_tls=job.scale_verify_tls == "true",
        )

        output_dir = job.output_dir
        if not output_dir:
            safe_name = job.vm_name.replace(" ", "_")
            output_dir = os.path.join(settings.conversion_dir, safe_name)

        self.context.update({
            "vm_name": job.vm_name,
            "vmware_client": vmware_client,
            "scale_client": scale_client,
            "output_dir": output_dir,
            "use_vddk": self.context.get("use_vddk", True),
            "vddk_dir": self._find_vddk_dir(),
            "virtio_iso": settings.virtio_iso,
            "disks_uploaded": json.loads(job.disks_uploaded_json) if job.disks_uploaded_json else [],
        })

    def _find_vddk_dir(self) -> str:
        candidate = os.path.join(settings.vddk_dir, "vmware-vix-disklib-distrib")
        if os.path.isdir(candidate):
            return candidate
        if os.path.isdir(settings.vddk_dir):
            return settings.vddk_dir
        return ""

    def _get_stages(self, job: MigrationJob) -> list[BaseStage]:
        stages: list[BaseStage] = []
        pf = self._make_progress_fn
        lf = self._make_log_fn

        if not job.v2v_completed:
            stages.append(ValidateVmwareStage(self.job_id, self.context, pf(), lf()))
            stages.append(FetchVmConfigStage(self.job_id, self.context, pf(), lf()))
            stages.append(VirtV2VConvertStage(self.job_id, self.context, pf(), lf()))
        if not job.upload_completed:
            stages.append(ScaleUploadStage(self.job_id, self.context, pf(), lf()))
        if not job.vm_created:
            stages.append(ScaleCreateVmStage(self.job_id, self.context, pf(), lf()))
        stages.append(CleanupStage(self.job_id, self.context, pf(), lf()))
        return stages

    def _make_progress_fn(self):
        job_id = self.job_id

        async def _on_progress(pct: float, msg: str):
            await self._update_db(progress_percent=pct, progress_message=msg)
            await ws_manager.broadcast_job_update(job_id, {
                "progress_percent": pct,
                "progress_message": msg,
            })

        def sync_wrapper(pct: float, msg: str):
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(_on_progress(pct, msg))
            except RuntimeError:
                pass

        return sync_wrapper

    def _make_log_fn(self):
        job_id = self.job_id

        async def _on_log(level: str, line: str):
            if self._log_file:
                self._log_file.write(f"[{level.upper()}] {line}\n")
                self._log_file.flush()
            await ws_manager.broadcast_job_log(job_id, level, line)

        def sync_wrapper(level: str, line: str):
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(_on_log(level, line))
            except RuntimeError:
                pass

        return sync_wrapper

    def _open_log_file(self):
        os.makedirs(settings.log_dir, exist_ok=True)
        log_path = os.path.join(settings.log_dir, f"job_{self.job_id}.log")
        self.context["log_file_path"] = log_path
        self._log_file = open(log_path, "a")

    def _close_log_file(self):
        if self._log_file:
            self._log_file.close()
            self._log_file = None

    async def _mark_stage_complete(self, stage: BaseStage):
        updates = {}
        if stage.name == "converting":
            updates["v2v_completed"] = 1
        elif stage.name == "uploading":
            updates["upload_completed"] = 1
            updates["disks_uploaded_json"] = json.dumps(
                self.context.get("disks_uploaded", [])
            )
            updates["disk_count"] = self.context.get("disk_count", 0)
        elif stage.name == "creating_vm":
            updates["vm_created"] = 1
            updates["scale_vm_uuid"] = self.context.get("scale_vm_uuid", "")

        if stage.name == "fetching_config":
            config = self.context.get("vm_config", {})
            updates["vm_cpu_count"] = config.get("cpu_count", 0)
            updates["vm_memory_bytes"] = config.get("memory_bytes", 0)
            updates["vm_nics_json"] = json.dumps(config.get("nics", []))
            updates["vm_disks_json"] = json.dumps(config.get("disks", []))
            updates["vm_os_type"] = config.get("os_type", "")
            updates["vm_firmware"] = config.get("firmware", "")

        if updates:
            await self._update_db(**updates)

    async def pause(self):
        if self._current_stage:
            await self._current_stage.cancel()
        await self._update_db(status=JobStatus.PAUSED)
        await ws_manager.broadcast_job_update(self.job_id, {
            "status": JobStatus.PAUSED,
        })

    async def cancel(self):
        if self._current_stage:
            await self._current_stage.cancel()
        await self._update_db(status=JobStatus.CANCELLED)
        await ws_manager.broadcast_job_update(self.job_id, {
            "status": JobStatus.CANCELLED,
        })

    async def _load_job(self) -> MigrationJob | None:
        async with async_session() as session:
            job = await session.get(MigrationJob, self.job_id)
            if job:
                # Detach from session
                session.expunge(job)
            return job

    async def _update_db(self, **kwargs):
        async with async_session() as session:
            await session.execute(
                update(MigrationJob)
                .where(MigrationJob.id == self.job_id)
                .values(**kwargs)
            )
            await session.commit()
