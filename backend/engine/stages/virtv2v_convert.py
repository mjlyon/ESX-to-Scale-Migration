import os

from backend.engine.progress import parse_v2v_progress
from backend.engine.stages.base import BaseStage
from backend.engine.subprocess_wrapper import ManagedSubprocess


class VirtV2VConvertStage(BaseStage):
    name = "converting"
    description = "Converting VM with virt-v2v"

    async def execute(self) -> bool:
        vm_name = self.context["vm_name"]
        output_dir = self.context["output_dir"]
        vmware_client = self.context["vmware_client"]
        use_vddk = self.context.get("use_vddk", True)
        vddk_dir = self.context.get("vddk_dir", "")

        os.makedirs(output_dir, exist_ok=True)

        pass_file = vmware_client.create_password_file()

        cmd = [
            "virt-v2v",
            "-i", "libvirt",
            "-ic", vmware_client.uri,
            "-ip", pass_file,
            vm_name,
            "-o", "local",
            "-os", output_dir,
            "-of", "raw",
            "--machine-readable",
        ]

        env = {
            "LIBGUESTFS_BACKEND": "direct",
            "LIBVIRT_AUTH_FILE": vmware_client._create_auth_file(),
        }

        if use_vddk and vddk_dir:
            lib_path = ""
            for subdir in ("lib64", "lib"):
                candidate = os.path.join(vddk_dir, subdir)
                if os.path.isdir(candidate):
                    lib_path = candidate
                    break
            if not lib_path and os.path.exists(os.path.join(vddk_dir, "libvixDiskLib.so")):
                lib_path = vddk_dir

            if lib_path:
                env["LD_LIBRARY_PATH"] = lib_path + ":" + os.environ.get("LD_LIBRARY_PATH", "")

                thumbprint = await vmware_client.get_thumbprint()
                if thumbprint:
                    self.on_log("info", f"ESXi SSL thumbprint: {thumbprint}")
                    cmd.extend([
                        "-it", "vddk",
                        "-io", f"vddk-libdir={vddk_dir}",
                        "-io", f"vddk-thumbprint={thumbprint}",
                    ])
                else:
                    self.on_log("warn", "Could not retrieve ESXi thumbprint, skipping VDDK transport")
            else:
                self.on_log("warn", f"VDDK lib directory not found at {vddk_dir}")

        # Mount virtio-win if available
        virtio_iso = self.context.get("virtio_iso", "")
        if virtio_iso and os.path.isfile(virtio_iso):
            self.on_log("info", f"VirtIO drivers available at {virtio_iso}")

        self.on_log("info", f"Running: {' '.join(cmd)}")
        self.on_progress(0, "Starting virt-v2v conversion...")

        self._process = ManagedSubprocess(cmd=cmd, env=env)
        pid = await self._process.start()
        self.context["current_pid"] = pid

        async for line in self._process.stream_output():
            self.on_log("info", line)
            progress = parse_v2v_progress(line)
            if progress is not None:
                self.on_progress(progress, line)
            if self._cancelled:
                break

        rc = await self._process.wait()
        self.context["current_pid"] = None

        if self._cancelled:
            self.on_log("warn", "virt-v2v conversion cancelled")
            return False

        if rc != 0:
            self.on_log("error", f"virt-v2v failed with exit code {rc}")
            self.context["error"] = f"virt-v2v exited with code {rc}"
            return False

        self.on_log("info", "virt-v2v conversion completed successfully")
        self.on_progress(100, "Conversion complete")
        return True
