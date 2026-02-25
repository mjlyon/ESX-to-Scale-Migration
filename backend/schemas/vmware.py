from __future__ import annotations

from pydantic import BaseModel
from datetime import datetime


class VmwareConnectionCreate(BaseModel):
    name: str
    host: str
    username: str
    connection_type: str = "vcenter"
    insecure: str = "true"
    vcenter_hint: str = ""


class VmwareConnectionResponse(BaseModel):
    id: int
    name: str
    host: str
    username: str
    connection_type: str
    insecure: str
    vcenter_hint: str
    created_at: datetime | None = None
    last_used_at: datetime | None = None

    model_config = {"from_attributes": True}


class VmwareTestRequest(BaseModel):
    host: str
    username: str
    password: str
    connection_type: str = "vcenter"
    insecure: bool = True
    vcenter_hint: str = ""


class VmwareListRequest(BaseModel):
    host: str
    username: str
    password: str
    connection_type: str = "vcenter"
    insecure: bool = True
    vcenter_hint: str = ""


class VmInfo(BaseModel):
    name: str
    state: str
    can_migrate: bool


class VmwareListResponse(BaseModel):
    vms: list[VmInfo]
    connection_uri: str


class VmConfigRequest(BaseModel):
    host: str
    username: str
    password: str
    vm_name: str
    connection_type: str = "vcenter"
    insecure: bool = True
    vcenter_hint: str = ""


class VmDiskInfo(BaseModel):
    device: str
    source: str
    size_bytes: int = 0


class VmNicInfo(BaseModel):
    mac: str = ""
    model: str = ""
    network: str = ""


class VmConfigResponse(BaseModel):
    name: str
    cpu_count: int
    memory_bytes: int
    os_type: str = ""
    firmware: str = "bios"
    disks: list[VmDiskInfo]
    nics: list[VmNicInfo]
