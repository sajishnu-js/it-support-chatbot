"""Pre-compute a portable Knowledge Base index for the serverless deployment.

The Python backend embeds locally with sentence-transformers, which cannot run
on Vercel (torch alone exceeds the serverless bundle limit). This script does
the same chunking as ingest.py but embeds with the Gemini embedding API, so the
Next.js API routes can embed a query the same way at request time and compare
vectors directly — no model weights needed at runtime.

Output: frontend/src/data/kb-index.json (committed, loaded by the API routes).

Run after changing anything in documents/:
    ./venv/bin/python build_kb_index.py
"""

import json
import math
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from dotenv import load_dotenv

import ingest

load_dotenv()

EMBEDDING_MODEL = "gemini-embedding-001"
DIMENSIONS = 768
# The free tier rate-limits embedding calls aggressively, so keep batches small
# and pace them. CACHE_PATH lets an interrupted run resume instead of paying
# for every chunk again.
BATCH_SIZE = 10
PAUSE_SECONDS = 2
MAX_RETRIES = 6
OUTPUT_PATH = os.path.join("frontend", "src", "data", "kb-index.json")
CACHE_PATH = os.path.join("vectorstore", "gemini-embedding-cache.json")
API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"


def _post(url: str, payload: dict) -> dict:
    """POST with retry/backoff on the quota (429) and transient (503) errors
    the free tier returns regularly — otherwise a single blip loses the run."""
    for attempt in range(MAX_RETRIES):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()[:200]
            if exc.code in (429, 503) and attempt < MAX_RETRIES - 1:
                wait = min(60, 5 * 2 ** attempt)
                print(f"    {exc.code} — backing off {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            raise SystemExit(f"Embedding request failed ({exc.code}): {body}")
    raise SystemExit("Embedding request failed after retries.")


def _normalise(vector: list) -> list:
    """Unit-length the vector so cosine similarity is a plain dot product,
    keeping the runtime search in the API route as cheap as possible."""
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return [0.0] * len(vector)
    return [round(value / magnitude, 6) for value in vector]


def embed_batch(texts: list, api_key: str) -> list:
    """Embed up to BATCH_SIZE texts in one call, as documents rather than a
    query — Gemini uses the task type to optimise the vector for retrieval."""
    payload = {
        "requests": [
            {
                "model": f"models/{EMBEDDING_MODEL}",
                "content": {"parts": [{"text": text}]},
                "taskType": "RETRIEVAL_DOCUMENT",
                "outputDimensionality": DIMENSIONS,
            }
            for text in texts
        ]
    }
    url = f"{API_ROOT}/{EMBEDDING_MODEL}:batchEmbedContents?key={api_key}"
    data = _post(url, payload)
    return [_normalise(item["values"]) for item in data["embeddings"]]


def main() -> None:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key in {"", "YOUR_GEMINI_API_KEY_HERE"}:
        raise SystemExit("GEMINI_API_KEY is not set in .env — cannot build the index.")

    filenames = sorted(
        name
        for name in os.listdir(ingest.DOCUMENTS_DIR)
        if os.path.splitext(name)[1].lower() in ingest.SUPPORTED_EXTENSIONS
    )
    print(f"Found {len(filenames)} documents")

    chunks, documents = [], []

    for filename in filenames:
        path = os.path.join(ingest.DOCUMENTS_DIR, filename)
        split = ingest._SPLITTER.split_documents(ingest.load_document(path))
        stat = os.stat(path)
        ext = os.path.splitext(filename)[1].lower()
        category = ingest._infer_category(filename)

        for piece in split:
            chunks.append({
                "filename": filename,
                "ext": ext,
                "category": category,
                "page": piece.metadata.get("page"),
                "text": piece.page_content,
            })

        documents.append({
            "filename": filename,
            "ext": ext,
            "category": category,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "status": "Indexed",
            "chunk_count": len(split),
            "indexed_at": datetime.now(timezone.utc).isoformat(),
            # Full text so the serverless deployment can serve document
            # previews without a filesystem to read from.
            "text": "\n".join(page.page_content for page in ingest.load_document(path)),
        })
        print(f"  {filename}: {len(split)} chunks")

    # Resume from any previous partial run: the cache is keyed by chunk text so
    # it stays valid as long as documents/ hasn't changed.
    cache = {}
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as handle:
            cache = json.load(handle)
        print(f"Resuming with {len(cache)} cached embeddings")

    pending = [c for c in chunks if c["text"] not in cache]
    print(f"Embedding {len(pending)} of {len(chunks)} chunks with {EMBEDDING_MODEL}...")

    for start in range(0, len(pending), BATCH_SIZE):
        batch = pending[start:start + BATCH_SIZE]
        for chunk, vector in zip(batch, embed_batch([c["text"] for c in batch], api_key)):
            cache[chunk["text"]] = vector

        os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
        with open(CACHE_PATH, "w", encoding="utf-8") as handle:
            json.dump(cache, handle)

        print(f"  embedded {min(start + BATCH_SIZE, len(pending))}/{len(pending)}")
        if start + BATCH_SIZE < len(pending):
            time.sleep(PAUSE_SECONDS)

    for chunk in chunks:
        chunk["embedding"] = cache[chunk["text"]]

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as out:
        json.dump({
            "embedding_model": EMBEDDING_MODEL,
            "dimensions": DIMENSIONS,
            "chunk_size": ingest.CHUNK_SIZE,
            "chunk_overlap": ingest.CHUNK_OVERLAP,
            "built_at": datetime.now(timezone.utc).isoformat(),
            "documents": documents,
            "chunks": chunks,
        }, out)

    size_mb = os.path.getsize(OUTPUT_PATH) / 1_048_576
    print(f"Wrote {OUTPUT_PATH} — {len(documents)} documents / {len(chunks)} chunks / {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
