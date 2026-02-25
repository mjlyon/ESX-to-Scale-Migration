from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_path: str = "/data/db/esx2scale.db"
    conversion_dir: str = "/data/conversions"
    vddk_dir: str = "/data/vddk"
    log_dir: str = "/data/logs"
    upload_dir: str = "/data/uploads"
    mount_dir: str = "/data/mounts"
    max_concurrent_jobs: int = 2
    virtio_iso: str = "/usr/share/virtio-win/virtio-win.iso"
    dev_mode: bool = False

    model_config = {"env_prefix": "ESX2SCALE_"}


settings = Settings()
