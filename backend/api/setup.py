import os
import subprocess

import psutil
from fastapi import APIRouter, UploadFile

from backend.config import settings
from backend.engine.vddk import get_vddk_status, handle_vddk_upload, remove_vddk
from backend.schemas.settings import (
    SetupStatusResponse,
    SystemInfo,
    VddkStatus,
    VirtioStatus,
)

router = APIRouter()


@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status():
    vddk = get_vddk_status()
    virtio_available = os.path.isfile(settings.virtio_iso)

    # System info
    kvm_available = os.path.exists("/dev/kvm")
    v2v_version = ""
    try:
        result = subprocess.run(
            ["virt-v2v", "--version"], capture_output=True, text=True, timeout=5
        )
        v2v_version = result.stdout.strip()
    except Exception:
        pass

    mem = psutil.virtual_memory()
    system = SystemInfo(
        cpu_count=psutil.cpu_count() or 1,
        memory_total_bytes=mem.total,
        memory_available_bytes=mem.available,
        kvm_available=kvm_available,
        virt_v2v_version=v2v_version,
        libguestfs_ok=bool(v2v_version),
    )

    ready = vddk["installed"] and bool(v2v_version)

    return SetupStatusResponse(
        vddk=VddkStatus(**vddk),
        virtio=VirtioStatus(available=virtio_available, path=settings.virtio_iso if virtio_available else None),
        system=system,
        ready=ready,
    )


@router.post("/vddk/upload")
async def upload_vddk(file: UploadFile):
    if not file.filename or not file.filename.endswith((".tar.gz", ".tgz")):
        return {"error": "File must be a .tar.gz archive"}
    result = await handle_vddk_upload(file)
    return result


@router.delete("/vddk")
async def delete_vddk():
    remove_vddk()
    return {"ok": True}


@router.get("/vddk/status")
async def vddk_status():
    return get_vddk_status()


@router.get("/system-info", response_model=SystemInfo)
async def system_info():
    kvm_available = os.path.exists("/dev/kvm")
    v2v_version = ""
    try:
        result = subprocess.run(
            ["virt-v2v", "--version"], capture_output=True, text=True, timeout=5
        )
        v2v_version = result.stdout.strip()
    except Exception:
        pass

    mem = psutil.virtual_memory()
    return SystemInfo(
        cpu_count=psutil.cpu_count() or 1,
        memory_total_bytes=mem.total,
        memory_available_bytes=mem.available,
        kvm_available=kvm_available,
        virt_v2v_version=v2v_version,
        libguestfs_ok=bool(v2v_version),
    )
