from __future__ import annotations

from pydantic import BaseModel


class VddkStatus(BaseModel):
    installed: bool
    lib_path: str | None = None
    base_dir: str | None = None


class VirtioStatus(BaseModel):
    available: bool
    path: str | None = None


class SystemInfo(BaseModel):
    cpu_count: int
    memory_total_bytes: int
    memory_available_bytes: int
    kvm_available: bool
    virt_v2v_version: str = ""
    libguestfs_ok: bool = False


class SetupStatusResponse(BaseModel):
    vddk: VddkStatus
    virtio: VirtioStatus
    system: SystemInfo
    ready: bool
