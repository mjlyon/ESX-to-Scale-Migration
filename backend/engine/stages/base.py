from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable

from backend.engine.subprocess_wrapper import ManagedSubprocess


class BaseStage(ABC):
    name: str = "base"
    description: str = ""

    def __init__(
        self,
        job_id: int,
        context: dict,
        on_progress: Callable[[float, str], None],
        on_log: Callable[[str, str], None],
    ):
        self.job_id = job_id
        self.context = context
        self.on_progress = on_progress
        self.on_log = on_log
        self._cancelled = False
        self._process: ManagedSubprocess | None = None

    @abstractmethod
    async def execute(self) -> bool:
        ...

    async def cancel(self):
        self._cancelled = True
        if self._process:
            await self._process.terminate()
