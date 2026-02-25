from fastapi import APIRouter

from backend.api import migrations, scale, setup, storage, vmware

api_router = APIRouter()

api_router.include_router(vmware.router, prefix="/vmware", tags=["vmware"])
api_router.include_router(migrations.router, prefix="/migrations", tags=["migrations"])
api_router.include_router(scale.router, prefix="/scale", tags=["scale"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(setup.router, prefix="/setup", tags=["setup"])


@api_router.get("/health")
async def health():
    return {"status": "ok"}
