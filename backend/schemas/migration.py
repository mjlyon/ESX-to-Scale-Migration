from __future__ import annotations

from pydantic import BaseModel
from datetime import datetime


class MigrationVm(BaseModel):
    name: str


class MigrationCreateRequest(BaseModel):
    # VMware source
    vmware_host: str
    vmware_user: str
    vmware_password: str
    vmware_connection_type: str = "vcenter"
    vmware_insecure: bool = True
    vmware_vcenter_hint: str = ""

    # Scale target
    scale_host: str
    scale_user: str
    scale_password: str
    scale_verify_tls: bool = False

    # Storage
    storage_config_id: int | None = None

    # VMs to migrate
    vms: list[MigrationVm]

    # Options
    use_vddk: bool = True
    auto_start: bool = True


class MigrationJobResponse(BaseModel):
    id: int
    vm_name: str
    vmware_host: str
    vmware_user: str
    vmware_connection_type: str
    scale_host: str
    scale_user: str
    status: str
    current_stage: str
    progress_percent: float
    progress_message: str
    vm_cpu_count: int
    vm_memory_bytes: int
    disk_count: int
    total_disk_size_bytes: int
    output_dir: str
    created_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str
    v2v_completed: int
    upload_completed: int
    vm_created: int
    log_file: str
    scale_vm_uuid: str

    model_config = {"from_attributes": True}


class MigrationStatsResponse(BaseModel):
    total: int
    pending: int
    active: int
    completed: int
    failed: int
    cancelled: int
    paused: int
