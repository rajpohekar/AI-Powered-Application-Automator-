import os
from typing import List, Dict, Any

COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")

class CohereReranker:
    def __init__(self):
        if COHERE_API_KEY and not COHERE_API_KEY.startswith("your_"):
            try:
                import cohere
                self.client = cohere.ClientV2(api_key=COHERE_API_KEY)
                self.use_mock = False
            except Exception as e:
                print(f"Failed to load cohere library, running in mock mode: {str(e)}")
                self.client = None
                self.use_mock = True
        else:
            print("WARNING: Valid Cohere API Key not detected. Reranker operations will return default ranking order.")
            self.client = None
            self.use_mock = True

    def rerank_chunks(self, query: str, chunks: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
        """
        Reranks a list of retrieved chunks against a query using Cohere's rerank engine.
        """
        if not chunks:
            return []
            
        if self.use_mock or not self.client:
            # Fallback: return top_n based on original vector search similarity scores
            return chunks[:top_n]

        try:
            # Format inputs
            documents = [chunk["content"] for chunk in chunks]
            
            response = self.client.rerank(
                model="rerank-english-v3.0",
                query=query,
                documents=documents,
                top_n=top_n
            )
            
            reranked_chunks = []
            for result in response.results:
                index = result.index
                relevance_score = result.relevance_score
                
                original_chunk = chunks[index]
                # Merge reranker scores
                original_chunk["rerank_score"] = relevance_score
                reranked_chunks.append(original_chunk)
                
            return reranked_chunks
        except Exception as e:
            print(f"Error calling Cohere Rerank API: {str(e)}. Falling back to original vectors.")
            return chunks[:top_n]
