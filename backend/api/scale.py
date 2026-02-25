from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.engine.scale_client import ScaleClient
from backend.models.scale_connection import ScaleConnection
from backend.schemas.scale import (
    ScaleConnectionCreate,
    ScaleConnectionResponse,
    ScaleTestRequest,
)

router = APIRouter()


@router.get("/connections", response_model=list[ScaleConnectionResponse])
async def list_connections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScaleConnection).order_by(ScaleConnection.created_at.desc()))
    return result.scalars().all()


@router.post("/connections", response_model=ScaleConnectionResponse)
async def create_connection(req: ScaleConnectionCreate, db: AsyncSession = Depends(get_db)):
    conn = ScaleConnection(**req.model_dump())
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.delete("/connections/{conn_id}")
async def delete_connection(conn_id: int, db: AsyncSession = Depends(get_db)):
    conn = await db.get(ScaleConnection, conn_id)
    if not conn:
        raise HTTPException(404, "Connection not found")
    await db.delete(conn)
    await db.commit()
    return {"ok": True}


@router.post("/test")
async def test_connection(req: ScaleTestRequest):
    client = ScaleClient(
        host=req.host,
        username=req.username,
        password=req.password,
        verify_tls=req.verify_tls,
    )
    ok, msg = await client.test_connection()
    return {"success": ok, "message": msg}


@router.post("/vms")
async def list_vms(req: ScaleTestRequest):
    client = ScaleClient(
        host=req.host,
        username=req.username,
        password=req.password,
        verify_tls=req.verify_tls,
    )
    vms = await client.list_vms()
    return vms


@router.post("/disks")
async def list_disks(req: ScaleTestRequest):
    client = ScaleClient(
        host=req.host,
        username=req.username,
        password=req.password,
        verify_tls=req.verify_tls,
    )
    disks = await client.list_disks()
    return disks
