from fastapi import APIRouter

router = APIRouter()


class QueryRequest:
    """TODO: pydantic model — course_id, question."""


@router.post("/api/query")
async def query(payload: dict) -> dict:
    """
    GraphRAG-forward retrieval — STATUS UNKNOWN per project:learning-demo:spec.
    Trusted-substrate / speculative-layer split is load-bearing: the avatar
    answers only from the trusted substrate (ingested corpus documents), never
    from unconstrained generation. A confabulated behavior protocol is worse
    than no avatar.

    This stub always returns "insufficient trusted substrate" rather than
    fabricating an answer, so the contract is enforced even before real
    retrieval logic lands.
    """
    return {
        "success": True,
        "data": {
            "answer": None,
            "citations": [],
            "status": "insufficient_trusted_substrate",
            "question": payload.get("question"),
        },
    }
