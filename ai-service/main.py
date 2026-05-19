import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import embed, retrieve, generate

# Initialize FastAPI App
app = FastAPI(
    title="Job Autofill Assistant - RAG Service",
    description="Python FastAPI RAG Microservice managing document chunking, OpenAI embeddings, Qdrant vectors, and Cohere reranking.",
    version="1.0.0"
)

# Setup CORS for the local dev setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect Route Blueprints
app.include_router(embed.router)
app.include_router(retrieve.router)
app.include_router(generate.router)

@app.get("/health")
def health_check():
    """
    RAG Service status checking
    """
    return {
        "status": "online",
        "service": "Job Autofill AI RAG Engine"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
