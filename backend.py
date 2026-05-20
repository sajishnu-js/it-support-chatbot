from fastapi import FastAPI
from pydantic import BaseModel
from rag_pipeline import query_rag

app = FastAPI(title="IT Support RAG API")

class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    answer: str
    sources: list

@app.get("/")
def home():
    return {"status": "IT Support RAG API is running"}

@app.post("/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):

    if not request.question.strip():
        return AnswerResponse(
            answer="Please enter a valid question.",
            sources=[]
        )

    result = query_rag(request.question)

    return AnswerResponse(
        answer=result["answer"],
        sources=result["sources"]
    )