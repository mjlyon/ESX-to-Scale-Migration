import os
import sys

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import settings


class Base(DeclarativeBase):
    pass


_db_dir = os.path.dirname(settings.db_path)
os.makedirs(_db_dir, exist_ok=True)

engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.db_path}",
    echo=False,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


async def init_db():
    # Import models so they register with Base.metadata
    import backend.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Safe migrations for new columns on existing databases
        migrations = [
            "ALTER TABLE migration_jobs ADD COLUMN create_vm_option INTEGER DEFAULT 1",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # Column already exists


async def get_db():
    async with async_session() as session:
        yield session


if __name__ == "__main__" and "--migrate" in sys.argv:
    import asyncio

    asyncio.run(init_db())
    print("Database initialized.")
