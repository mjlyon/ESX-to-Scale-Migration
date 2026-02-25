from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.engine.vmware_client import VmwareClient
from backend.models.vmware_connection import VmwareConnection
from backend.schemas.vmware import (
    VmConfigRequest,
    VmConfigResponse,
    VmDiskInfo,
    VmInfo,
    VmNicInfo,
    VmwareConnectionCreate,
    VmwareConnectionResponse,
    VmwareListRequest,
    VmwareListResponse,
    VmwareTestRequest,
)

router = APIRouter()


@router.get("/connections", response_model=list[VmwareConnectionResponse])
async def list_connections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VmwareConnection).order_by(VmwareConnection.created_at.desc()))
    return result.scalars().all()


@router.post("/connections", response_model=VmwareConnectionResponse)
async def create_connection(req: VmwareConnectionCreate, db: AsyncSession = Depends(get_db)):
    conn = VmwareConnection(**req.model_dump())
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.delete("/connections/{conn_id}")
async def delete_connection(conn_id: int, db: AsyncSession = Depends(get_db)):
    conn = await db.get(VmwareConnection, conn_id)
    if not conn:
        raise HTTPException(404, "Connection not found")
    await db.delete(conn)
    await db.commit()
    return {"ok": True}


@router.post("/test")
async def test_connection(req: VmwareTestRequest):
    client = VmwareClient(
        host=req.host,
        username=req.username,
        password=req.password,
        connection_type=req.connection_type,
        insecure=req.insecure,
        vcenter_hint=req.vcenter_hint,
    )
    try:
        ok, msg = await client.test_connection()
        return {"success": ok, "message": msg, "uri": client.uri}
    finally:
        client.cleanup()


@router.post("/vms", response_model=VmwareListResponse)
async def list_vms(req: VmwareListRequest):
    client = VmwareClient(
        host=req.host,
        username=req.username,
        password=req.password,
        connection_type=req.connection_type,
        insecure=req.insecure,
        vcenter_hint=req.vcenter_hint,
    )
    try:
        vms = await client.list_vms()
        return VmwareListResponse(
            vms=[VmInfo(**vm) for vm in vms],
            connection_uri=client.uri,
        )
    finally:
        client.cleanup()


@router.post("/vm-config", response_model=VmConfigResponse)
async def get_vm_config(req: VmConfigRequest):
    client = VmwareClient(
        host=req.host,
        username=req.username,
        password=req.password,
        connection_type=req.connection_type,
        insecure=req.insecure,
        vcenter_hint=req.vcenter_hint,
    )
    try:
        config = await client.get_vm_config(req.vm_name)
        return VmConfigResponse(
            name=config["name"],
            cpu_count=config["cpu_count"],
            memory_bytes=config["memory_bytes"],
            os_type=config.get("os_type", ""),
            firmware=config.get("firmware", "bios"),
            disks=[VmDiskInfo(**d) for d in config["disks"]],
            nics=[VmNicInfo(**n) for n in config["nics"]],
        )
    finally:
        client.cleanup()
