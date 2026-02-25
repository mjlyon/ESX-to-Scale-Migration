from __future__ import annotations

import os
import re
import tempfile
import xml.etree.ElementTree as ET

from backend.engine.subprocess_wrapper import ManagedSubprocess


class VmwareClient:
    """Wraps virsh commands for VMware ESX operations."""

    def __init__(
        self,
        host: str,
        username: str,
        password: str,
        connection_type: str = "vcenter",
        insecure: bool = True,
        vcenter_hint: str = "",
        timeout: int = 30,
    ):
        self.host = host
        self.username = username
        self.password = password
        self.connection_type = connection_type
        self.insecure = insecure
        self.vcenter_hint = vcenter_hint
        self.timeout = timeout
        self.uri = self._build_uri()
        self._auth_file: str | None = None
        self._pass_file: str | None = None

    def _build_uri(self) -> str:
        nv = "1" if self.insecure else "0"
        uri = f"esx://{self.username}@{self.host}/?no_verify={nv}"
        hint = self.vcenter_hint
        if self.connection_type == "vcenter":
            hint = ""
        elif not hint:
            hint = "*"
        if hint and hint.lower() != "none":
            uri += f"&vcenter={hint}"
        return uri

    def _create_auth_file(self) -> str:
        if self._auth_file:
            return self._auth_file
        fd, path = tempfile.mkstemp(prefix="esx2scale.auth.", suffix=".conf")
        with os.fdopen(fd, "w") as f:
            f.write(f"[credentials-vmware]\n")
            f.write(f"username={self.username}\n")
            f.write(f"password={self.password}\n\n")
            f.write(f"[auth-esx-default]\n")
            f.write(f"credentials=vmware\n\n")
            f.write(f"[auth-vpx-default]\n")
            f.write(f"credentials=vmware\n")
        os.chmod(path, 0o600)
        self._auth_file = path
        return path

    def create_password_file(self) -> str:
        if self._pass_file:
            return self._pass_file
        fd, path = tempfile.mkstemp(prefix="esx2scale.pass.")
        with os.fdopen(fd, "w") as f:
            f.write(self.password)
        os.chmod(path, 0o600)
        self._pass_file = path
        return path

    def cleanup(self):
        for f in (self._auth_file, self._pass_file):
            if f and os.path.exists(f):
                os.unlink(f)
        self._auth_file = None
        self._pass_file = None

    def _env(self) -> dict:
        auth = self._create_auth_file()
        return {
            "LIBVIRT_AUTH_FILE": auth,
            "LIBVIRT_DEFAULT_URI": self.uri,
        }

    async def test_connection(self) -> tuple[bool, str]:
        proc = ManagedSubprocess(
            cmd=[
                "timeout", "--foreground", str(self.timeout),
                "virsh", "-k", "0", "-K", "0", "-c", self.uri, "uri",
            ],
            env=self._env(),
        )
        await proc.start()
        output_lines: list[str] = []
        async for line in proc.stream_output():
            output_lines.append(line)
        rc = await proc.wait()
        output = "\n".join(output_lines)
        if rc == 0:
            return True, output
        if rc == 124:
            return False, f"Timed out after {self.timeout}s"
        return False, f"Connection failed (rc={rc}): {output}"

    async def list_vms(self) -> list[dict]:
        proc = ManagedSubprocess(
            cmd=[
                "timeout", "--foreground", str(self.timeout),
                "virsh", "-k", "0", "-K", "0", "-c", self.uri,
                "list", "--all",
            ],
            env=self._env(),
        )
        await proc.start()
        output_lines: list[str] = []
        async for line in proc.stream_output():
            output_lines.append(line)
        rc = await proc.wait()
        if rc != 0:
            raise RuntimeError(f"virsh list failed (rc={rc}): {''.join(output_lines)}")
        return self._parse_vm_list(output_lines)

    def _parse_vm_list(self, lines: list[str]) -> list[dict]:
        vms: list[dict] = []
        for line in lines:
            if not line.strip():
                continue
            if re.match(r"^\s*Id\s", line):
                continue
            if re.match(r"^-+$", line):
                continue
            if "password for" in line.lower():
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            if parts[-2] == "shut" and parts[-1] == "off":
                state = "shut off"
                name = " ".join(parts[1:-2])
            else:
                state = parts[-1].lower()
                name = " ".join(parts[1:-1])
            name = name.strip()
            if not name:
                continue
            can_migrate = state in ("shut off", "shutoff")
            vms.append({"name": name, "state": state, "can_migrate": can_migrate})
        return vms

    async def get_vm_config(self, vm_name: str) -> dict:
        proc = ManagedSubprocess(
            cmd=[
                "timeout", "--foreground", str(self.timeout),
                "virsh", "-k", "0", "-K", "0", "-c", self.uri,
                "dumpxml", vm_name,
            ],
            env=self._env(),
        )
        await proc.start()
        output_lines: list[str] = []
        async for line in proc.stream_output():
            output_lines.append(line)
        rc = await proc.wait()
        if rc != 0:
            raise RuntimeError(f"virsh dumpxml failed: {''.join(output_lines)}")
        xml_str = "\n".join(output_lines)
        return self._parse_vm_xml(xml_str, vm_name)

    def _parse_vm_xml(self, xml_str: str, vm_name: str) -> dict:
        root = ET.fromstring(xml_str)
        vcpu_el = root.find("vcpu")
        cpu_count = int(vcpu_el.text) if vcpu_el is not None and vcpu_el.text else 1

        mem_el = root.find("memory")
        mem_kib = int(mem_el.text) if mem_el is not None and mem_el.text else 0
        mem_unit = mem_el.get("unit", "KiB") if mem_el is not None else "KiB"
        memory_bytes = self._to_bytes(mem_kib, mem_unit)

        os_el = root.find("os")
        os_type = ""
        firmware = "bios"
        if os_el is not None:
            type_el = os_el.find("type")
            if type_el is not None:
                os_type = type_el.text or ""
            loader_el = os_el.find("loader")
            if loader_el is not None:
                firmware = "uefi"

        disks: list[dict] = []
        for disk_el in root.findall(".//disk"):
            if disk_el.get("device") != "disk":
                continue
            source = disk_el.find("source")
            target = disk_el.find("target")
            disks.append({
                "device": target.get("dev", "") if target is not None else "",
                "source": source.get("file", source.get("dev", "")) if source is not None else "",
                "size_bytes": 0,
            })

        nics: list[dict] = []
        for iface in root.findall(".//interface"):
            mac_el = iface.find("mac")
            model_el = iface.find("model")
            source_el = iface.find("source")
            nics.append({
                "mac": mac_el.get("address", "") if mac_el is not None else "",
                "model": model_el.get("type", "") if model_el is not None else "",
                "network": source_el.get("network", source_el.get("bridge", "")) if source_el is not None else "",
            })

        return {
            "name": vm_name,
            "cpu_count": cpu_count,
            "memory_bytes": memory_bytes,
            "os_type": os_type,
            "firmware": firmware,
            "disks": disks,
            "nics": nics,
        }

    @staticmethod
    def _to_bytes(value: int, unit: str) -> int:
        unit = unit.lower()
        if unit in ("kib", "k"):
            return value * 1024
        if unit in ("mib", "m"):
            return value * 1024 * 1024
        if unit in ("gib", "g"):
            return value * 1024 * 1024 * 1024
        if unit in ("b", "bytes"):
            return value
        return value * 1024  # default KiB

    async def get_thumbprint(self) -> str:
        proc = ManagedSubprocess(
            cmd=[
                "bash", "-c",
                f"openssl s_client -connect {self.host}:443 < /dev/null 2>/dev/null | "
                f"openssl x509 -fingerprint -sha1 -noout -in /dev/stdin 2>/dev/null | "
                f"cut -d= -f2",
            ],
        )
        await proc.start()
        output: list[str] = []
        async for line in proc.stream_output():
            output.append(line)
        await proc.wait()
        thumbprint = "".join(output).strip()
        return thumbprint
