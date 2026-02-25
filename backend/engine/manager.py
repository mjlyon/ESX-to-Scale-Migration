import asyncio
from collections import deque

from sqlalchemy import select, update

from backend.database import async_session
from backend.engine.worker import MigrationWorker
from backend.models.migration_job import JobStatus, MigrationJob


class MigrationManager:
    """Manages concurrent migration execution with a configurable pool."""

    def __init__(self, max_concurrent: int = 2):
        self.max_concurrent = max_concurrent
        self.active_workers: dict[int, MigrationWorker] = {}
        self.queue: deque[tuple[int, dict]] = deque()  # (job_id, context)
        self._lock = asyncio.Lock()

    async def submit_job(self, job_id: int, context: dict):
        async with self._lock:
            if len(self.active_workers) < self.max_concurrent:
                await self._start_worker(job_id, context)
            else:
                self.queue.append((job_id, context))

    async def pause_job(self, job_id: int):
        worker = self.active_workers.get(job_id)
        if worker:
            await worker.pause()

    async def cancel_job(self, job_id: int):
        worker = self.active_workers.get(job_id)
        if worker:
            await worker.cancel()
        else:
            # Check if in queue
            new_queue = deque()
            for qid, ctx in self.queue:
                if qid == job_id:
                    async with async_session() as session:
                        await session.execute(
                            update(MigrationJob)
                            .where(MigrationJob.id == job_id)
                            .values(status=JobStatus.CANCELLED)
                        )
                        await session.commit()
                else:
                    new_queue.append((qid, ctx))
            self.queue = new_queue

    async def resume_interrupted_jobs(self):
        """On startup, mark interrupted running jobs as PAUSED."""
        running_states = [
            JobStatus.VALIDATING,
            JobStatus.FETCHING_CONFIG,
            JobStatus.CONVERTING,
            JobStatus.UPLOADING,
            JobStatus.CREATING_VM,
        ]
        async with async_session() as session:
            result = await session.execute(
                select(MigrationJob).where(
                    MigrationJob.status.in_([s.value for s in running_states])
                )
            )
            jobs = result.scalars().all()
            for job in jobs:
                job.status = JobStatus.PAUSED
                job.progress_message = "Interrupted by container restart"
            await session.commit()

    async def _start_worker(self, job_id: int, context: dict):
        worker = MigrationWorker(
            job_id=job_id,
            context=context,
            on_done=self._on_worker_done,
        )
        self.active_workers[job_id] = worker
        asyncio.create_task(worker.run())

    async def _on_worker_done(self, job_id: int):
        async with self._lock:
            self.active_workers.pop(job_id, None)
            if self.queue and len(self.active_workers) < self.max_concurrent:
                next_id, next_ctx = self.queue.popleft()
                await self._start_worker(next_id, next_ctx)

    async def shutdown(self):
        for worker in list(self.active_workers.values()):
            await worker.cancel()

    def get_status(self) -> dict:
        return {
            "active_jobs": len(self.active_workers),
            "queued_jobs": len(self.queue),
            "max_concurrent": self.max_concurrent,
            "active_job_ids": list(self.active_workers.keys()),
        }
