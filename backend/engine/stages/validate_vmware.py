from backend.engine.stages.base import BaseStage
from backend.engine.vmware_client import VmwareClient


class ValidateVmwareStage(BaseStage):
    name = "validating"
    description = "Validating VMware connectivity"

    async def execute(self) -> bool:
        self.on_log("info", "Validating VMware connectivity...")
        client: VmwareClient = self.context["vmware_client"]
        self.on_progress(0, "Testing VMware connection...")

        ok, msg = await client.test_connection()
        if not ok:
            self.on_log("error", f"VMware connection failed: {msg}")
            self.context["error"] = msg
            return False

        self.on_log("info", f"VMware connection validated: {msg}")
        self.on_progress(100, "VMware connection validated")
        return True
