from __future__ import annotations

import os
import subprocess
import tarfile

from backend.config import settings

EXPECTED_SUBDIR = "vmware-vix-disklib-distrib"


async def handle_vddk_upload(upload_file) -> dict:
    """Receive uploaded VDDK tarball, extract to /data/vddk/."""
    os.makedirs(settings.vddk_dir, exist_ok=True)
    upload_path = os.path.join(settings.vddk_dir, "vddk-upload.tar.gz")

    with open(upload_path, "wb") as f:
        while True:
            chunk = await upload_file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)

    with tarfile.open(upload_path, "r:gz") as tar:
        tar.extractall(path=settings.vddk_dir)

    os.remove(upload_path)

    lib_path = find_vddk_lib_path()

    # Configure ldconfig
    conf_path = "/etc/ld.so.conf.d/vmware-vddk.conf"
    try:
        with open(conf_path, "w") as f:
            f.write(lib_path + "\n")
        subprocess.run(["ldconfig"], capture_output=True, timeout=10)
    except Exception:
        pass

    return {
        "installed": True,
        "lib_path": lib_path,
        "base_dir": os.path.join(settings.vddk_dir, EXPECTED_SUBDIR),
    }


def find_vddk_lib_path() -> str | None:
    base = os.path.join(settings.vddk_dir, EXPECTED_SUBDIR)
    for subdir in ("lib64", "lib"):
        candidate = os.path.join(base, subdir)
        if os.path.isdir(candidate):
            return candidate
    # Check if libs are directly in the base dir
    if os.path.exists(os.path.join(base, "libvixDiskLib.so")):
        return base
    return None


def get_vddk_status() -> dict:
    lib_path = find_vddk_lib_path()
    base_dir = os.path.join(settings.vddk_dir, EXPECTED_SUBDIR)
    return {
        "installed": lib_path is not None,
        "lib_path": lib_path,
        "base_dir": base_dir if lib_path else None,
    }


def remove_vddk():
    import shutil
    base = os.path.join(settings.vddk_dir, EXPECTED_SUBDIR)
    if os.path.isdir(base):
        shutil.rmtree(base)
    conf_path = "/etc/ld.so.conf.d/vmware-vddk.conf"
    if os.path.exists(conf_path):
        os.remove(conf_path)
    try:
        subprocess.run(["ldconfig"], capture_output=True, timeout=10)
    except Exception:
        pass
