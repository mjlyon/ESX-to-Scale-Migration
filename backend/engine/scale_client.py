from __future__ import annotations

import json
import os
from urllib.parse import quote

import httpx


class ScaleClient:
    """HTTP client for Scale Computing SC// Platform REST API."""

    def __init__(
        self,
        host: str,
        username: str,
        password: str,
        verify_tls: bool = False,
    ):
        self.host = host
        self.username = username
        self.password = password
        self.verify_tls = verify_tls
        self.base_url = f"https://{host}"

    async def test_connection(self) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(
                verify=self.verify_tls, timeout=15
            ) as client:
                resp = await client.get(
                    f"{self.base_url}/rest/v1/VirDomain",
                    auth=(self.username, self.password),
                )
                if resp.status_code == 200:
                    return True, "Connected successfully"
                return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            return False, str(e)

    async def list_vms(self) -> list[dict]:
        async with httpx.AsyncClient(
            verify=self.verify_tls, timeout=30
        ) as client:
            resp = await client.get(
                f"{self.base_url}/rest/v1/VirDomain",
                auth=(self.username, self.password),
            )
            resp.raise_for_status()
            return resp.json()

    async def list_disks(self) -> list[dict]:
        async with httpx.AsyncClient(
            verify=self.verify_tls, timeout=30
        ) as client:
            resp = await client.get(
                f"{self.base_url}/rest/v1/VirtualDisk",
                auth=(self.username, self.password),
            )
            resp.raise_for_status()
            return resp.json()

    async def upload_disk(
        self,
        filepath: str,
        on_progress: callable | None = None,
    ) -> tuple[bool, str]:
        fname = os.path.basename(filepath)
        size = os.path.getsize(filepath)
        encoded_name = quote(fname, safe="")
        url = (
            f"{self.base_url}/rest/v1/VirtualDisk/upload"
            f"?filename={encoded_name}&filesize={size}"
        )

        uploaded = 0

        async def stream_file():
            nonlocal uploaded
            with open(filepath, "rb") as f:
                while True:
                    chunk = f.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    uploaded += len(chunk)
                    if on_progress:
                        pct = (uploaded / size) * 100
                        on_progress(pct, f"Uploading {fname}: {pct:.1f}%")
                    yield chunk

        try:
            async with httpx.AsyncClient(
                verify=self.verify_tls,
                timeout=httpx.Timeout(connect=30, read=None, write=None, pool=30),
            ) as client:
                resp = await client.put(
                    url,
                    content=stream_file(),
                    headers={
                        "Content-Type": "application/octet-stream",
                        "Content-Length": str(size),
                    },
                    auth=(self.username, self.password),
                )
                if resp.status_code in (200, 201):
                    return True, f"Upload complete: {fname}"
                return False, f"HTTP {resp.status_code}: {resp.text[:500]}"
        except Exception as e:
            return False, str(e)

    async def create_vm(
        self,
        name: str,
        cpu_count: int,
        memory_bytes: int,
        disk_names: list[str],
        disk_sizes: list[int],
        nic_count: int = 1,
        firmware: str = "bios",
    ) -> tuple[bool, str, str]:
        """Create a VM on SC// Platform.

        Returns (success, message, vm_uuid).
        """
        block_devs = []
        for i, (dname, dsize) in enumerate(zip(disk_names, disk_sizes)):
            block_devs.append({
                "type": "VIRTIO_DISK",
                "capacity": dsize,
                "name": dname,
                "slot": i,
                "cacheMode": "WRITETHROUGH",
            })

        net_devs = []
        for _ in range(max(nic_count, 1)):
            net_devs.append({
                "type": "VIRTIO",
                "vlan": 0,
                "connected": True,
            })

        payload = {
            "dom": {
                "name": name,
                "mem": memory_bytes,
                "numVCPU": cpu_count,
                "blockDevs": block_devs,
                "netDevs": net_devs,
            },
            "options": {
                "attachGuestToolsISO": True,
            },
        }

        # Set machine type for UEFI
        if firmware == "uefi":
            payload["dom"]["machineType"] = "virt"

        try:
            async with httpx.AsyncClient(
                verify=self.verify_tls, timeout=30
            ) as client:
                resp = await client.post(
                    f"{self.base_url}/rest/v1/VirDomain",
                    json=payload,
                    auth=(self.username, self.password),
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    vm_uuid = ""
                    if isinstance(data, dict):
                        vm_uuid = data.get("createdUUID", data.get("uuid", ""))
                    elif isinstance(data, list) and data:
                        vm_uuid = data[0].get("uuid", "")
                    return True, "VM created successfully", vm_uuid
                return False, f"HTTP {resp.status_code}: {resp.text[:500]}", ""
        except Exception as e:
            return False, str(e), ""
