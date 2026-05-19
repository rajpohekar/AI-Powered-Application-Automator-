# Pydantic models for request/response serialization
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class FieldInfo(BaseModel):
    id: str = Field(..., description="The ID of the form field in DOM")
    name: str = Field(..., description="The name attribute of the form field")
    labelText: str = Field("", description="The textual label next to the input field")
    semanticLabel: str = Field("unknown", description="The inferred semantic role of the field")
    type: str = Field("text", description="Type of HTML field: text, email, select, etc.")
    placeholder: str = Field("", description="The input placeholder content")

class GenerateRequest(BaseModel):
    user_id: str = Field(..., description="Owner of the resume to perform vector RAG search against")
    fields: List[FieldInfo] = Field(..., description="List of form input contexts to answer")
    custom_fields: Optional[Dict[str, str]] = Field(default_factory=dict, description="Arbitrary custom key-value profile data")

class GenerateResponse(BaseModel):
    success: bool
    filledValues: Dict[str, str] = Field(..., description="Key-value mapping of field ID/name to generated answers")

class RetrieveQuery(BaseModel):
    user_id: str
    query: str
    limit: Optional[int] = 5

class RetrieveResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
