from fastapi import APIRouter, HTTPException
from schemas.models import GenerateRequest, GenerateResponse
from core.retriever import ResumeRetriever
from core.reranker import CohereReranker
from core.generator import AutofillGenerator
from typing import Dict, List

router = APIRouter(prefix="/api")

retriever = ResumeRetriever()
reranker = CohereReranker()
generator = AutofillGenerator()

@router.post("/generate", response_model=GenerateResponse)
async def generate_answers(payload: GenerateRequest):
    """
    Core RAG orchestrator: retrieves resume context matching form fields,
    filters using Cohere reranking, and prompts the LLM to write exact answers.
    """
    try:
        user_id = payload.user_id
        fields = [f.model_dump() for f in payload.fields]
        print(f"DEBUG: Incoming fields payload: {fields}")
        print(f"DEBUG: Custom fields payload: {payload.custom_fields}")
        
        # 1. Collate queries based on field labels
        # Instead of querying for every field separately, we aggregate queries by semantic type
        semantic_queries = list(set([f.get("semanticLabel", "general") for f in fields]))
        if not semantic_queries:
            semantic_queries = ["general"]
            
        retrieved_chunks = []
        seen_ids = set()

        # 2. Vector search matched chunks for each query type
        for query in semantic_queries:
            hits = retriever.search_resume_context(user_id=user_id, query=query, limit=5)
            for hit in hits:
                if hit["id"] not in seen_ids:
                    seen_ids.add(hit["id"])
                    retrieved_chunks.append(hit)
                    
        # 3. Apply Phase 2 Optimization: Cohere Reranking
        # Rerank and filter chunks to select the top 4 most contextually matching snippets
        query_aggregate = ", ".join(semantic_queries)
        final_context_chunks = reranker.rerank_chunks(
            query=query_aggregate,
            chunks=retrieved_chunks,
            top_n=4
        )

        # 4. Prompt the LLM to output the logical matching answers
        filled_values = generator.generate_fill_values(
            fields=fields,
            resume_chunks=final_context_chunks,
            custom_fields=payload.custom_fields
        )
        print(f"DEBUG: Generated filled values: {filled_values}")

        return {
            "success": True,
            "filledValues": filled_values
        }

    except Exception as e:
        print(f"RAG Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate matching answers: {str(e)}")
