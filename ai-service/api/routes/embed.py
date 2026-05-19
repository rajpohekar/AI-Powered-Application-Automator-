import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from core.chunker import DocumentChunker
from core.embedder import ResumeEmbedder
from db.qdrant_client import create_user_collection_if_not_exists, get_qdrant_client
from qdrant_client.http import models

router = APIRouter(prefix="/api")

TEMP_DIR = "/tmp/uploads" if os.name != 'nt' else "./uploads_temp"
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/embed")
async def embed_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """
    Parses PDF/DOCX resumes, splits them, computes dense embeddings, 
    and inserts them into the user's dedicated Qdrant collection.
    """
    file_ext = os.path.splitext(file.filename)[1]
    if file_ext.lower() not in ['.pdf', '.docx']:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX documents are supported.")

    # 1. Save uploaded file temporarily to parse
    temp_filepath = os.path.join(TEMP_DIR, f"{user_id}{file_ext}")
    try:
        with open(temp_filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Extract full text from binary document
        parsed_text = DocumentChunker.extract_text(temp_filepath, file_ext)
        if not parsed_text.strip():
            raise HTTPException(status_code=422, detail="Unable to extract text from the document.")
            
        # 3. Split full text into sliding window semantic chunks
        chunks = DocumentChunker.chunk_text(parsed_text)
        
        # 4. Generate collection & embeddings
        collection_name = f"resume_user_{user_id}"
        create_user_collection_if_not_exists(collection_name)
        
        embedder = ResumeEmbedder()
        chunk_contents = [c["content"] for c in chunks]
        embeddings = embedder.get_embeddings_batch(chunk_contents)
        
        # 5. Insert vectors into Qdrant index
        qdrant = get_qdrant_client()
        points = []
        for index, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            points.append(
                models.PointStruct(
                    id=index,
                    vector=vector,
                    payload={
                        "content": chunk["content"],
                        "metadata": chunk["metadata"]
                    }
                )
            )
            
        qdrant.upsert(
            collection_name=collection_name,
            points=points
        )
        
        return {
            "success": True,
            "message": "Resume uploaded, parsed and vectorized inside Qdrant.",
            "collection_name": collection_name,
            "parsed_text": parsed_text[:2000] # return preview
        }
        
    except Exception as e:
        print(f"Indexing route error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse and embed resume: {str(e)}")
        
    finally:
        # File cleanup
        if os.path.exists(temp_filepath):
            try:
                os.remove(temp_filepath)
            except Exception:
                pass
