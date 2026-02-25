import os
import shutil
import subprocess

from backend.config import settings


class StorageManager:
    """Manages storage backends: local, NFS, SMB."""

    def mount(self, config) -> str:
        if config.storage_type == "local":
            os.makedirs(config.path, exist_ok=True)
            return config.path

        mount_point = os.path.join(settings.mount_dir, f"storage_{config.id}")
        os.makedirs(mount_point, exist_ok=True)

        if self._is_mounted(mount_point):
            return mount_point

        if config.storage_type == "nfs":
            source = f"{config.nfs_server}:{config.nfs_export}"
            cmd = ["mount", "-t", "nfs"]
            if config.nfs_options:
                cmd += ["-o", config.nfs_options]
            cmd += [source, mount_point]

        elif config.storage_type == "smb":
            source = f"//{config.smb_server}/{config.smb_share}"
            cmd = ["mount", "-t", "cifs"]
            opts = []
            if config.smb_username:
                opts.append(f"username={config.smb_username}")
            if config.smb_domain:
                opts.append(f"domain={config.smb_domain}")
            if config.smb_options:
                opts.append(config.smb_options)
            if opts:
                cmd += ["-o", ",".join(opts)]
            cmd += [source, mount_point]
        else:
            raise ValueError(f"Unknown storage type: {config.storage_type}")

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise RuntimeError(f"Mount failed: {result.stderr}")

        return mount_point

    def unmount(self, config):
        if config.storage_type == "local":
            return
        mount_point = os.path.join(settings.mount_dir, f"storage_{config.id}")
        if self._is_mounted(mount_point):
            subprocess.run(["umount", mount_point], capture_output=True, timeout=30)

    def _is_mounted(self, path: str) -> bool:
        result = subprocess.run(
            ["mountpoint", "-q", path], capture_output=True, timeout=5
        )
        return result.returncode == 0

    @staticmethod
    def get_disk_usage(path: str) -> dict:
        usage = shutil.disk_usage(path)
        return {
            "path": path,
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
            "percent_used": round((usage.used / usage.total) * 100, 1) if usage.total else 0,
        }

    def test_mount(self, config) -> dict:
        mount_point = self.mount(config)
        try:
            usage = self.get_disk_usage(mount_point)
            # Test write access
            test_file = os.path.join(mount_point, ".esx2scale_test")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            return {"success": True, "mount_point": mount_point, **usage}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            if config.storage_type != "local":
                self.unmount(config)


storage_manager = StorageManager()
