import os
import numpy as np
from openai import OpenAI
from typing import List

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

class ResumeEmbedder:
    def __init__(self):
        # Gracefully handle missing API keys to support development environments
        if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("your_"):
            self.client = OpenAI(api_key=OPENAI_API_KEY)
            self.use_mock = False
        else:
            print("WARNING: Valid OpenAI API Key not detected. Embedding operations will fallback to mock vectors.")
            self.client = None
            self.use_mock = True
            
        self.model = "text-embedding-3-small"

    def get_embedding(self, text: str) -> List[float]:
        """
        Generates a 1536-dimension dense embedding vector for a given string text.
        """
        if self.use_mock:
            # Generate a reproducible random unit vector based on hashing text
            seed = sum(ord(char) for char in text) % 2**32
            rng = np.random.default_rng(seed)
            vector = rng.standard_normal(1536)
            unit_vector = vector / np.linalg.norm(vector)
            return unit_vector.tolist()

        try:
            response = self.client.embeddings.create(
                input=[text.replace("\n", " ")],
                model=self.model
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Error calling OpenAI Embeddings API: {str(e)}")
            raise e

    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Batch gets embeddings for a list of string chunks.
        """
        if self.use_mock:
            return [self.get_embedding(text) for text in texts]

        try:
            response = self.client.embeddings.create(
                input=[t.replace("\n", " ") for t in texts],
                model=self.model
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            print(f"Error calling OpenAI Embeddings Batch API: {str(e)}")
            raise e
