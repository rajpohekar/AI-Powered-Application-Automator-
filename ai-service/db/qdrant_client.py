import os
from qdrant_client import QdrantClient
from qdrant_client.http import models

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

# Lazy-initialized client (avoids failing on import when Qdrant isn't up yet)
_client: QdrantClient | None = None

def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    return _client

def create_user_collection_if_not_exists(collection_name: str, vector_size: int = 1536):
    """
    Creates a dedicated vector collection for a candidate's resume if it doesn't already exist.
    Default vector size is 1536, corresponding to OpenAI text-embedding-3-small / text-embedding-ada-002.
    """
    try:
        qdrant = get_qdrant_client()
        collections = qdrant.get_collections().collections
        exists = any(c.name == collection_name for c in collections)
        
        if not exists:
            qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE
                )
            )
            print(f"Created Qdrant Vector Collection: {collection_name}")
        else:
            print(f"Qdrant Vector Collection already exists: {collection_name}")
    except Exception as e:
        print(f"Error checking/creating Qdrant Collection {collection_name}: {str(e)}")
        raise e
