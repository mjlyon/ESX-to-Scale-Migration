from backend.engine.scale_client import ScaleClient
from backend.engine.stages.base import BaseStage


class ScaleCreateVmStage(BaseStage):
    name = "creating_vm"
    description = "Creating VM on SC// Platform"

    async def execute(self) -> bool:
        vm_name = self.context["vm_name"]
        scale_client: ScaleClient = self.context["scale_client"]
        vm_config = self.context.get("vm_config", {})
        disk_names = self.context.get("uploaded_disk_names", [])
        disk_sizes = self.context.get("uploaded_disk_sizes", [])

        cpu_count = vm_config.get("cpu_count", 1)
        memory_bytes = vm_config.get("memory_bytes", 1024 * 1024 * 1024)
        nic_count = len(vm_config.get("nics", [{"type": "default"}]))
        firmware = vm_config.get("firmware", "bios")

        self.on_log("info", f"Creating VM '{vm_name}' on SC// Platform")
        self.on_log("info", f"  CPU: {cpu_count}, Memory: {memory_bytes // (1024*1024)}MB, "
                    f"NICs: {nic_count}, Disks: {len(disk_names)}, Firmware: {firmware}")
        self.on_progress(0, f"Creating VM '{vm_name}'...")

        ok, msg, vm_uuid = await scale_client.create_vm(
            name=vm_name,
            cpu_count=cpu_count,
            memory_bytes=memory_bytes,
            disk_names=disk_names,
            disk_sizes=disk_sizes,
            nic_count=nic_count,
            firmware=firmware,
        )

        if not ok:
            self.on_log("error", f"VM creation failed: {msg}")
            self.context["error"] = msg
            return False

        self.context["scale_vm_uuid"] = vm_uuid
        self.on_log("info", f"VM created successfully. UUID: {vm_uuid}")
        self.on_progress(100, "VM created on SC// Platform")
        return True
