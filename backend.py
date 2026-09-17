import json
import os
import shutil
import time
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import ingest
from rag_pipeline import get_llm, load_vectorstore, query_rag, stream_rag

app = FastAPI(title="IT Support RAG API")

_allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANALYTICS_PATH = os.path.join(ingest.VECTORSTORE_DIR, "analytics.json")
RECENT_ACTIVITY_LIMIT = 20
RELATED_DOCS_LIMIT = 3
_START_TIME = time.time()

# ------------------------------------------------------------------ settings
# In-memory retrieval configuration, shared by every request. There is a
# single deployment-wide config (no per-user auth), so this is intentionally
# simple rather than backed by a database.
_settings = {"top_k": 3, "strict_mode": True}

# Cached so every /ask call doesn't reload the embedding model + FAISS index
# from disk. Invalidated by _reload_cache() after any index mutation.
_cache = {"vectorstore": None, "llm": None}


def _reload_cache() -> None:
    _cache["vectorstore"] = None
    _cache["llm"] = None


def _get_vectorstore():
    if _cache["vectorstore"] is None:
        _cache["vectorstore"] = load_vectorstore()
    return _cache["vectorstore"]


def _get_llm():
    if _cache["llm"] is None:
        _cache["llm"] = get_llm()
    return _cache["llm"]


def _load_analytics() -> dict:
    if not os.path.exists(ANALYTICS_PATH):
        return {"total_questions": 0, "recent_activity": []}
    with open(ANALYTICS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_analytics(data: dict) -> None:
    os.makedirs(ingest.VECTORSTORE_DIR, exist_ok=True)
    with open(ANALYTICS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _record_question(question: str, source_count: int) -> None:
    data = _load_analytics()
    data["total_questions"] = data.get("total_questions", 0) + 1
    activity = data.get("recent_activity", [])
    activity.insert(0, {
        "question": question,
        "source_count": source_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    data["recent_activity"] = activity[:RECENT_ACTIVITY_LIMIT]
    _save_analytics(data)


def _documents_by_filename() -> dict:
    return {d["filename"]: d for d in ingest.list_documents()}


def _enrich_sources_with_category(sources: list, by_filename: dict) -> list:
    """Tags each citation with its real Knowledge Base category, so the UI
    (and the ticket-summary generator) can reflect what actually answered the
    question rather than guessing from unrelated metadata."""
    for source in sources:
        doc = by_filename.get(source["filename"])
        source["category"] = doc["category"] if doc else "helpdesk"
    return sources


def _related_documents(cited_filenames: list, by_filename: dict, limit: int = RELATED_DOCS_LIMIT) -> list:
    """Other indexed Knowledge Base files sharing a category with what was cited.

    Purely derived from real, already-computed category metadata — never
    fabricated. Returns [] once nothing else in the category qualifies.
    """
    if not cited_filenames:
        return []
    cited_categories = {
        by_filename[name]["category"] for name in cited_filenames if name in by_filename
    }
    if not cited_categories:
        return []

    related = [
        {"filename": d["filename"], "category": d["category"], "chunk_count": d["chunk_count"]}
        for d in by_filename.values()
        if d["status"] == "Indexed"
        and d["category"] in cited_categories
        and d["filename"] not in cited_filenames
    ]
    return related[:limit]


@app.on_event("startup")
def bootstrap() -> None:
    """Build the vector store on first-ever run, then warm the cache."""
    if not os.path.exists(os.path.join(ingest.VECTORSTORE_DIR, "index.faiss")):
        ingest.ingest_documents()
    _get_vectorstore()


class QuestionRequest(BaseModel):
    question: str
    top_k: int | None = None
    strict_mode: bool | None = None


class AnswerResponse(BaseModel):
    answer: str
    sources: list
    related: list = []


class SettingsUpdate(BaseModel):
    top_k: int | None = None
    strict_mode: bool | None = None


@app.get("/")
def home():
    return {"status": "IT Support RAG API is running"}


_PLACEHOLDER_KEYS = {"", "YOUR_GEMINI_API_KEY_HERE"}


@app.get("/health")
def health():
    vectorstore_ready = os.path.exists(os.path.join(ingest.VECTORSTORE_DIR, "index.faiss"))
    docs = ingest.list_documents()
    return {
        "status": "ok",
        "vectorstore_ready": vectorstore_ready,
        "llm_provider": "gemini",
        "llm_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "gemini_api_key_configured": os.getenv("GEMINI_API_KEY", "") not in _PLACEHOLDER_KEYS,
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "documents_count": len(docs),
        "indexed_chunks": sum(d["chunk_count"] for d in docs),
        "chunk_size": ingest.CHUNK_SIZE,
        "chunk_overlap": ingest.CHUNK_OVERLAP,
        "uptime_seconds": round(time.time() - _START_TIME),
    }


@app.post("/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):
    if not request.question.strip():
        return AnswerResponse(
            answer="Please enter a valid question.",
            sources=[]
        )

    top_k = request.top_k or _settings["top_k"]
    strict_mode = request.strict_mode if request.strict_mode is not None else _settings["strict_mode"]

    try:
        result = query_rag(
            request.question,
            k=top_k,
            strict_mode=strict_mode,
            vectorstore=_get_vectorstore(),
            llm=_get_llm(),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate an answer: {exc}")

    _record_question(request.question, len(result["sources"]))

    by_filename = _documents_by_filename()
    sources = _enrich_sources_with_category(result["sources"], by_filename)
    cited = [s["filename"] for s in sources]

    return AnswerResponse(
        answer=result["answer"],
        sources=sources,
        related=_related_documents(cited, by_filename),
    )


@app.post("/ask/stream")
def ask_question_stream(request: QuestionRequest):
    """NDJSON stream — one JSON object per line, in the order each stage
    actually completes, so the client can render real "Searching Knowledge
    Base -> Retrieved sources -> Generating" progress instead of a fake timer.

    Event shapes:
      {"type": "retrieval", "sources": [...]}            -- once retrieval finishes
      {"type": "token", "text": "..."}                    -- per generated chunk
      {"type": "sources", "sources": [...], "related": []} -- terminal, success
      {"type": "error", "message": "..."}                  -- terminal, failure
    """
    top_k = request.top_k or _settings["top_k"]
    strict_mode = request.strict_mode if request.strict_mode is not None else _settings["strict_mode"]

    def line(obj: dict) -> str:
        return json.dumps(obj) + "\n"

    if not request.question.strip():
        def empty():
            yield line({"type": "token", "text": "Please enter a valid question."})
            yield line({"type": "sources", "sources": [], "related": []})
        return StreamingResponse(empty(), media_type="application/x-ndjson")

    def generate():
        try:
            for kind, payload in stream_rag(
                request.question,
                k=top_k,
                strict_mode=strict_mode,
                vectorstore=_get_vectorstore(),
                llm=_get_llm(),
            ):
                if kind == "token":
                    yield line({"type": "token", "text": payload})
                elif kind == "retrieval":
                    by_filename = _documents_by_filename()
                    sources = _enrich_sources_with_category(payload, by_filename)
                    # Recorded here (not after generation) so analytics reflect real
                    # Knowledge Base usage even when the LLM call itself fails —
                    # retrieval is what actually happened, generation is a separate concern.
                    _record_question(request.question, len(sources))
                    yield line({"type": "retrieval", "sources": sources})
                else:  # "sources" — terminal
                    by_filename = _documents_by_filename()
                    sources = _enrich_sources_with_category(payload, by_filename)
                    cited = [s["filename"] for s in sources]
                    yield line({
                        "type": "sources",
                        "sources": sources,
                        "related": _related_documents(cited, by_filename),
                    })
        except Exception as exc:
            yield line({"type": "error", "message": f"Failed to generate a response: {exc}"})

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.get("/settings")
def get_settings():
    return _settings


@app.post("/settings")
def update_settings(update: SettingsUpdate):
    if update.top_k is not None:
        _settings["top_k"] = max(1, min(8, update.top_k))
    if update.strict_mode is not None:
        _settings["strict_mode"] = update.strict_mode
    return _settings


@app.get("/analytics")
def analytics():
    docs = ingest.list_documents()
    data = _load_analytics()

    by_category: dict = {}
    for d in docs:
        by_category[d["category"]] = by_category.get(d["category"], 0) + 1

    return {
        "total_documents": len(docs),
        "indexed_documents": sum(1 for d in docs if d["status"] == "Indexed"),
        "pending_documents": sum(1 for d in docs if d["status"] == "Pending"),
        "total_chunks": sum(d["chunk_count"] for d in docs),
        "total_questions": data.get("total_questions", 0),
        "recent_activity": data.get("recent_activity", []),
        "documents_by_category": by_category,
    }


@app.get("/documents")
def list_documents():
    return {"documents": ingest.list_documents()}


@app.post("/documents/upload")
def upload_document(file: UploadFile):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ingest.SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    path = os.path.join(ingest.DOCUMENTS_DIR, file.filename)
    with open(path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        entry = ingest.add_document(path)
    except Exception as exc:
        os.remove(path)
        raise HTTPException(status_code=500, detail=f"Failed to index document: {exc}")

    _reload_cache()
    return entry


@app.get("/documents/{filename}/preview")
def preview_document(filename: str):
    path = os.path.join(ingest.DOCUMENTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        docs = ingest.load_document(path)
        text = "\n".join(d.page_content for d in docs).strip()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to preview document: {exc}")

    limit = 800
    return {
        "filename": filename,
        "preview": text[:limit],
        "truncated": len(text) > limit,
    }


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    path = os.path.join(ingest.DOCUMENTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Document not found")
    ingest.remove_document(filename)
    _reload_cache()
    return {"deleted": filename}


@app.post("/documents/rebuild")
def rebuild_index():
    manifest = ingest.ingest_documents()
    _reload_cache()
    total_chunks = sum(v["chunk_count"] for v in manifest.values())
    return {"documents_indexed": len(manifest), "total_chunks": total_chunks}
