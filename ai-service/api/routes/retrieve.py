from fastapi import APIRouter, HTTPException
from schemas.models import RetrieveQuery, RetrieveResponse
from core.retriever import ResumeRetriever

router = APIRouter(prefix="/api")
retriever = ResumeRetriever()

@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_context(payload: RetrieveQuery):
    """
    RAG utility endpoint to directly query matched text snippets without compiling answers.
    """
    try:
        hits = retriever.search_resume_context(
            user_id=payload.user_id,
            query=payload.query,
            limit=payload.limit
        )
        return {
            "success": True,
            "results": hits
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Context query retrieval failed: {str(e)}")
