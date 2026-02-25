from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from backend.database import Base


class VmwareConnection(Base):
    __tablename__ = "vmware_connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    host = Column(String, nullable=False)
    username = Column(String, nullable=False)
    connection_type = Column(String, default="vcenter")
    insecure = Column(String, default="true")
    vcenter_hint = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now())
    last_used_at = Column(DateTime, nullable=True)
