from __future__ import annotations

from pydantic import BaseModel
from datetime import datetime


class StorageConfigCreate(BaseModel):
    name: str
    storage_type: str  # local | nfs | smb
    path: str = "/data/conversions"
    nfs_server: str = ""
    nfs_export: str = ""
    nfs_options: str = "vers=4,nolock"
    smb_server: str = ""
    smb_share: str = ""
    smb_username: str = ""
    smb_password: str = ""
    smb_domain: str = ""
    smb_options: str = ""
    is_default: bool = False


class StorageConfigResponse(BaseModel):
    id: int
    name: str
    storage_type: str
    path: str
    nfs_server: str
    nfs_export: str
    nfs_options: str
    smb_server: str
    smb_share: str
    smb_username: str
    smb_domain: str
    is_active: int
    is_default: int
    mount_point: str
    total_bytes: int
    free_bytes: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DiskUsageResponse(BaseModel):
    path: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent_used: float
