import json
import os

from backend.engine.scale_client import ScaleClient
from backend.engine.stages.base import BaseStage


class ScaleUploadStage(BaseStage):
    name = "uploading"
    description = "Uploading disk images to SC// Platform"

    async def execute(self) -> bool:
        output_dir = self.context["output_dir"]
        scale_client: ScaleClient = self.context["scale_client"]
        already_uploaded: list[str] = self.context.get("disks_uploaded", [])

        # Find disk files (raw, img, or qcow2)
        disk_files: list[str] = []
        for fname in sorted(os.listdir(output_dir)):
            fpath = os.path.join(output_dir, fname)
            if not os.path.isfile(fpath):
                continue
            if fname.endswith(".xml"):
                continue
            size = os.path.getsize(fpath)
            if size < 1024 * 1024:  # skip files < 1MB
                continue
            disk_files.append(fpath)

        if not disk_files:
            self.on_log("error", f"No disk images found in {output_dir}")
            self.context["error"] = "No disk images found after conversion"
            return False

        total = len(disk_files)
        self.on_log("info", f"Found {total} disk image(s) to upload")
        self.context["disk_count"] = total

        disk_names: list[str] = []
        disk_sizes: list[int] = []

        for i, fpath in enumerate(disk_files):
            fname = os.path.basename(fpath)
            if fname in already_uploaded:
                self.on_log("info", f"Skipping already-uploaded disk: {fname}")
                disk_names.append(fname)
                disk_sizes.append(os.path.getsize(fpath))
                continue

            self.on_log("info", f"Uploading disk {i+1}/{total}: {fname}")

            def progress_cb(pct: float, msg: str):
                overall = ((i / total) + (pct / 100 / total)) * 100
                self.on_progress(overall, msg)

            if self._cancelled:
                self.on_log("warn", "Upload cancelled")
                return False

            ok, msg = await scale_client.upload_disk(fpath, on_progress=progress_cb)
            if not ok:
                self.on_log("error", f"Upload failed: {msg}")
                self.context["error"] = msg
                return False

            self.on_log("info", f"Upload complete: {fname}")
            already_uploaded.append(fname)
            self.context["disks_uploaded"] = already_uploaded
            disk_names.append(fname)
            disk_sizes.append(os.path.getsize(fpath))

        self.context["uploaded_disk_names"] = disk_names
        self.context["uploaded_disk_sizes"] = disk_sizes
        self.on_progress(100, "All disks uploaded")
        return True
