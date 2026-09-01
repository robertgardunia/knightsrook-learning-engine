"""
Embedding is a separate seam from extraction/chunking so the model backing
it can change without touching either. text-embedding-3-small produces 1536
dims, matching substrate.corpus_chunks.embedding's VECTOR(1536).
"""

from typing import Protocol

from openai import AsyncOpenAI

from app.config import get_settings

EMBEDDING_MODEL = "text-embedding-3-small"


class Embedder(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class OpenAIEmbedder:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=get_settings().api_key)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embeddings.create(
            model=EMBEDDING_MODEL, input=texts
        )
        return [item.embedding for item in response.data]
