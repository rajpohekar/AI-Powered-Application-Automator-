from typing import List, Dict, Any
from db.qdrant_client import get_qdrant_client
from core.embedder import ResumeEmbedder
from qdrant_client.http import models

class ResumeRetriever:
    def __init__(self):
        self.qdrant = get_qdrant_client()
        self.embedder = ResumeEmbedder()

    def search_resume_context(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Calculates search query embeddings and retrieves matched document chunks from Qdrant.
        """
        collection_name = f"resume_user_{user_id}"
        
        try:
            # Generate target search vector
            query_vector = self.embedder.get_embedding(query)
            
            # Perform vector similarity query inside Qdrant
            if hasattr(self.qdrant, "query_points"):
                search_results = self.qdrant.query_points(
                    collection_name=collection_name,
                    query=query_vector,
                    limit=limit,
                    with_payload=True
                ).points
            else:
                search_results = self.qdrant.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=limit,
                    with_payload=True
                )
            
            hits = []
            for hit in search_results:
                hits.append({
                    "id": hit.id,
                    "score": hit.score,
                    "content": hit.payload.get("content", ""),
                    "metadata": hit.payload.get("metadata", {})
                })
                
            return hits
        except Exception as e:
            print(f"Error querying vectors in Qdrant collection {collection_name}: {str(e)}")
            return []
