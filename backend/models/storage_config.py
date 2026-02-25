from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from backend.database import Base


class StorageConfig(Base):
    __tablename__ = "storage_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    storage_type = Column(String, nullable=False)  # local | nfs | smb

    # Local
    path = Column(String, default="/data/conversions")

    # NFS
    nfs_server = Column(String, default="")
    nfs_export = Column(String, default="")
    nfs_options = Column(String, default="vers=4,nolock")

    # SMB
    smb_server = Column(String, default="")
    smb_share = Column(String, default="")
    smb_username = Column(String, default="")
    smb_domain = Column(String, default="")
    smb_options = Column(String, default="")

    # State
    is_active = Column(Integer, default=0)
    is_default = Column(Integer, default=0)
    mount_point = Column(String, default="")
    total_bytes = Column(Integer, default=0)
    free_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
