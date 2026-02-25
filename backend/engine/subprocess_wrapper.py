from __future__ import annotations

import asyncio
import os
import signal
from typing import AsyncIterator


class ManagedSubprocess:
    """Async subprocess wrapper with progress streaming and signal support."""

    def __init__(
        self,
        cmd: list[str],
        env: dict | None = None,
        cwd: str | None = None,
    ):
        self.cmd = cmd
        self.env = {**os.environ, **(env or {})}
        self.cwd = cwd
        self.process: asyncio.subprocess.Process | None = None
        self.pid: int | None = None

    async def start(self) -> int:
        self.process = await asyncio.create_subprocess_exec(
            *self.cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=self.env,
            cwd=self.cwd,
        )
        self.pid = self.process.pid
        return self.pid

    async def stream_output(self) -> AsyncIterator[str]:
        if not self.process or not self.process.stdout:
            return
        async for line in self.process.stdout:
            yield line.decode("utf-8", errors="replace").rstrip("\n")

    async def terminate(self, timeout: int = 10):
        if self.process and self.process.returncode is None:
            self.process.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(self.process.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

    async def wait(self) -> int:
        if not self.process:
            return -1
        return await self.process.wait()

    @property
    def returncode(self) -> int | None:
        if self.process:
            return self.process.returncode
        return None
