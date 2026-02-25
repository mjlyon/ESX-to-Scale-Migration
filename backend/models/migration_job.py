import enum

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from backend.database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    FETCHING_CONFIG = "fetching_config"
    CONVERTING = "converting"
    UPLOADING = "uploading"
    CREATING_VM = "creating_vm"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class MigrationJob(Base):
    __tablename__ = "migration_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Source VMware info
    vm_name = Column(String, nullable=False)
    vmware_host = Column(String, nullable=False)
    vmware_user = Column(String, nullable=False)
    vmware_connection_type = Column(String, default="vcenter")
    vmware_insecure = Column(String, default="true")
    vmware_vcenter_hint = Column(String, default="")

    # Target Scale info
    scale_host = Column(String, nullable=False)
    scale_user = Column(String, nullable=False)
    scale_verify_tls = Column(String, default="false")

    # VM config extracted from VMware
    vm_cpu_count = Column(Integer, default=0)
    vm_memory_bytes = Column(Integer, default=0)
    vm_nics_json = Column(Text, default="[]")  # JSON array of NIC configs
    vm_disks_json = Column(Text, default="[]")  # JSON array of disk configs
    vm_os_type = Column(String, default="")
    vm_firmware = Column(String, default="")  # bios or uefi

    # Job state
    status = Column(String, default=JobStatus.PENDING)
    current_stage = Column(String, default="")
    progress_percent = Column(Float, default=0.0)
    progress_message = Column(String, default="")

    # Disk tracking
    disk_count = Column(Integer, default=0)
    total_disk_size_bytes = Column(Integer, default=0)
    disks_uploaded_json = Column(Text, default="[]")  # JSON: list of uploaded filenames

    # Output
    output_dir = Column(String, default="")

    # Timing
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Error
    error_message = Column(Text, default="")

    # Stage completion flags (for resume)
    v2v_completed = Column(Integer, default=0)
    upload_completed = Column(Integer, default=0)
    vm_created = Column(Integer, default=0)

    # Log file path
    log_file = Column(String, default="")

    # Subprocess PID (for kill/pause)
    current_pid = Column(Integer, nullable=True)

    # Migration options
    create_vm_option = Column(Integer, default=1)  # 1=create VM, 0=disk upload only

    # Scale VM UUID after creation
    scale_vm_uuid = Column(String, default="")
