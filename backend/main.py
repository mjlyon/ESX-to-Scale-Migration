import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.router import api_router
from backend.api.ws import ws_router
from backend.config import settings
from backend.database import init_db
from backend.engine.manager import MigrationManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    for d in (settings.conversion_dir, settings.log_dir, settings.upload_dir, settings.mount_dir):
        os.makedirs(d, exist_ok=True)

    await init_db()

    app.state.migration_manager = MigrationManager(
        max_concurrent=settings.max_concurrent_jobs,
    )
    await app.state.migration_manager.resume_interrupted_jobs()

    yield

    # Shutdown
    await app.state.migration_manager.shutdown()


app = FastAPI(
    title="ESX to Scale Migration",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(ws_router)

# Serve React frontend (built static files)
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
