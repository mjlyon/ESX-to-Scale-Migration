from __future__ import annotations

from pydantic import BaseModel
from datetime import datetime


class ScaleConnectionCreate(BaseModel):
    name: str
    host: str
    username: str
    verify_tls: str = "false"


class ScaleConnectionResponse(BaseModel):
    id: int
    name: str
    host: str
    username: str
    verify_tls: str
    created_at: datetime | None = None
    last_used_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScaleTestRequest(BaseModel):
    host: str
    username: str
    password: str
    verify_tls: bool = False
