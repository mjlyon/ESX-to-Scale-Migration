import os
import shutil

from backend.engine.stages.base import BaseStage


class CleanupStage(BaseStage):
    name = "cleanup"
    description = "Cleaning up temporary files"

    async def execute(self) -> bool:
        output_dir = self.context.get("output_dir", "")
        vmware_client = self.context.get("vmware_client")

        if vmware_client:
            vmware_client.cleanup()
            self.on_log("info", "Cleaned up temporary credential files")

        self.on_log("info", f"Conversion artifacts remain at: {output_dir}")
        self.on_progress(100, "Cleanup complete")
        return True
