"""
Integration fixtures — a real asyncpg pool against the docker-compose `db`
service. `docker compose up -d db` must be running with a `.env` present
(see .env.example) for `integration`-marked tests to run; otherwise they
skip rather than fail, so `pytest` stays runnable without Docker for the
extractor/chunker unit tests.
"""

import asyncpg
import pydantic
import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def db_pool():
    from app.config import get_settings

    try:
        settings = get_settings()
    except pydantic.ValidationError as exc:
        pytest.skip(f"Retrieval settings not configured ({exc}) — see .env.example")
        return

    try:
        pool = await asyncpg.create_pool(
            host=settings.postgres_host,
            port=settings.postgres_port,
            user=settings.postgres_user,
            password=settings.postgres_pass,
            database=settings.postgres_db,
        )
    except (OSError, asyncpg.PostgresError) as exc:
        pytest.skip(f"Postgres not reachable ({exc}) — run `docker compose up -d db`")
        return

    try:
        yield pool
    finally:
        await pool.close()
