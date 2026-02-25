from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.engine.storage import storage_manager
from backend.models.storage_config import StorageConfig
from backend.schemas.storage import (
    DiskUsageResponse,
    StorageConfigCreate,
    StorageConfigResponse,
)

router = APIRouter()


@router.get("/configs", response_model=list[StorageConfigResponse])
async def list_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StorageConfig).order_by(StorageConfig.created_at.desc()))
    return result.scalars().all()


@router.post("/configs", response_model=StorageConfigResponse)
async def create_config(req: StorageConfigCreate, db: AsyncSession = Depends(get_db)):
    data = req.model_dump(exclude={"smb_password", "is_default"})
    config = StorageConfig(**data)
    if req.is_default:
        # Unset all other defaults
        await db.execute(update(StorageConfig).values(is_default=0))
        config.is_default = 1
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put("/configs/{config_id}", response_model=StorageConfigResponse)
async def update_config(config_id: int, req: StorageConfigCreate, db: AsyncSession = Depends(get_db)):
    config = await db.get(StorageConfig, config_id)
    if not config:
        raise HTTPException(404, "Storage config not found")
    data = req.model_dump(exclude={"smb_password", "is_default"})
    for k, v in data.items():
        setattr(config, k, v)
    if req.is_default:
        await db.execute(update(StorageConfig).values(is_default=0))
        config.is_default = 1
    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/configs/{config_id}")
async def delete_config(config_id: int, db: AsyncSession = Depends(get_db)):
    config = await db.get(StorageConfig, config_id)
    if not config:
        raise HTTPException(404, "Storage config not found")
    if config.is_active:
        raise HTTPException(400, "Cannot delete active storage - unmount first")
    await db.delete(config)
    await db.commit()
    return {"ok": True}


@router.post("/configs/{config_id}/mount")
async def mount_storage(config_id: int, db: AsyncSession = Depends(get_db)):
    config = await db.get(StorageConfig, config_id)
    if not config:
        raise HTTPException(404, "Storage config not found")
    try:
        mount_point = storage_manager.mount(config)
        config.is_active = 1
        config.mount_point = mount_point
        usage = storage_manager.get_disk_usage(mount_point)
        config.total_bytes = usage["total_bytes"]
        config.free_bytes = usage["free_bytes"]
        await db.commit()
        return {"ok": True, "mount_point": mount_point, **usage}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/configs/{config_id}/unmount")
async def unmount_storage(config_id: int, db: AsyncSession = Depends(get_db)):
    config = await db.get(StorageConfig, config_id)
    if not config:
        raise HTTPException(404, "Storage config not found")
    try:
        storage_manager.unmount(config)
        config.is_active = 0
        config.mount_point = ""
        await db.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/configs/{config_id}/test")
async def test_storage(config_id: int, db: AsyncSession = Depends(get_db)):
    config = await db.get(StorageConfig, config_id)
    if not config:
        raise HTTPException(404, "Storage config not found")
    result = storage_manager.test_mount(config)
    return result


@router.get("/disk-usage", response_model=DiskUsageResponse)
async def disk_usage(db: AsyncSession = Depends(get_db)):
    from backend.config import settings
    usage = storage_manager.get_disk_usage(settings.conversion_dir)
    return DiskUsageResponse(**usage)
