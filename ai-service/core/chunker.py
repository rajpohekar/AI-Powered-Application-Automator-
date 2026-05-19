import os
from pypdf import PdfReader
from docx import Document
from typing import List, Dict, Any

class DocumentChunker:
    @staticmethod
    def extract_text(filepath: str, file_extension: str) -> str:
        """
        Parses textual contents from PDF or DOCX file formats.
        """
        text = ""
        
        if file_extension.lower() == '.pdf':
            reader = PdfReader(filepath)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                    
        elif file_extension.lower() == '.docx':
            doc = Document(filepath)
            for para in doc.paragraphs:
                if para.text:
                    text += para.text + "\n"
                    
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
            
        return text

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[Dict[str, Any]]:
        """
        Splits a text document into overlapping chunks.
        Each chunk is returned as a dictionary with 'content' and metadata fields.
        """
        words = text.split()
        chunks = []
        
        step = chunk_size - overlap
        if step <= 0:
            step = chunk_size // 2

        for i in range(0, len(words), step):
            chunk_words = words[i:i + chunk_size]
            content = " ".join(chunk_words)
            
            # Skip empty or tiny chunks
            if len(content.strip()) < 15:
                continue
                
            chunks.append({
                "content": content,
                "metadata": {
                    "word_start": i,
                    "word_end": min(i + chunk_size, len(words)),
                    "character_length": len(content)
                }
            })
            
            # If we reached the end of document, break early
            if i + chunk_size >= len(words):
                break
                
        return chunks
