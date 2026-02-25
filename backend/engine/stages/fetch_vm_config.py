from backend.engine.stages.base import BaseStage
from backend.engine.vmware_client import VmwareClient


class FetchVmConfigStage(BaseStage):
    name = "fetching_config"
    description = "Fetching VM configuration from VMware"

    async def execute(self) -> bool:
        vm_name = self.context["vm_name"]
        client: VmwareClient = self.context["vmware_client"]
        self.on_log("info", f"Fetching VM config for '{vm_name}'...")
        self.on_progress(0, f"Fetching config for {vm_name}...")

        try:
            config = await client.get_vm_config(vm_name)
        except Exception as e:
            self.on_log("error", f"Failed to fetch VM config: {e}")
            self.context["error"] = str(e)
            return False

        self.context["vm_config"] = config
        self.on_log("info", f"VM config: CPU={config['cpu_count']}, "
                    f"Memory={config['memory_bytes'] // (1024*1024)}MB, "
                    f"Disks={len(config['disks'])}, "
                    f"NICs={len(config['nics'])}, "
                    f"Firmware={config['firmware']}")
        self.on_progress(100, "VM configuration fetched")
        return True
