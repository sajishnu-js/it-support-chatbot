import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

DOCUMENTS_DIR = "documents"
VECTORSTORE_DIR = "vectorstore"
MANIFEST_PATH = os.path.join(VECTORSTORE_DIR, "manifest.json")
SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf"}

# Fixed IT-support taxonomy. Order matters: it's also the match priority in
# _infer_category, so more specific categories are checked before the
# "helpdesk" catch-all. Keys are shared with the frontend; labels/icons live
# there since they're presentation, not classification.
CATEGORY_ORDER = [
    "network", "security", "microsoft365", "hardware",
    "software", "accounts", "infrastructure", "helpdesk",
]
_CATEGORY_KEYWORDS = {
    "network": {"network", "vpn", "wifi", "dns", "firewall", "connectivity"},
    "security": {"security", "phishing", "malware", "password", "mfa", "compliance", "antivirus"},
    "microsoft365": {"microsoft365", "m365", "office365", "outlook", "sharepoint", "teams", "exchange"},
    "hardware": {"hardware", "asset", "device", "laptop", "desktop", "printer"},
    "software": {"software", "application", "app", "license", "install"},
    "accounts": {"onboarding", "offboarding", "account", "activedirectory", "ad", "user", "identity", "directory"},
    "infrastructure": {"server", "infrastructure", "datacenter", "cloud", "backup"},
    "helpdesk": {"helpdesk", "faq", "sop", "support", "procedure", "policy", "general"},
}


def _infer_category(filename: str) -> str:
    """Best-effort IT category from a filename, using a fixed keyword taxonomy.

    Deterministic and based only on the real filename — never guessed content
    that isn't there. Falls back to "helpdesk" (General) when nothing matches.
    """
    stem = os.path.splitext(filename)[0].lower()
    tokens = set(re.split(r"[^a-z0-9]+", stem))
    for category in CATEGORY_ORDER:
        if _CATEGORY_KEYWORDS[category] & tokens:
            return category
    return "helpdesk"

# Guards load-modify-save sequences against concurrent uploads/deletes
# (the API server can handle multiple requests against the same process).
_LOCK = threading.Lock()

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ".", " ", ""],
)


_embeddings = None


def get_embeddings():
    """Lazily load the embedding model once per process and reuse it.

    Re-instantiating HuggingFaceEmbeddings reloads the model weights from
    disk (several seconds) on every call, which made add/remove document
    operations feel unresponsive.
    """
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return _embeddings


def load_manifest() -> dict:
    if not os.path.exists(MANIFEST_PATH):
        return {}
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_manifest(manifest: dict) -> None:
    os.makedirs(VECTORSTORE_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def load_document(path: str):
    """Load a single file into LangChain Documents based on its extension."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return PyPDFLoader(path).load()
    return TextLoader(path, encoding="utf-8").load()


def _vectorstore_exists() -> bool:
    return os.path.exists(os.path.join(VECTORSTORE_DIR, "index.faiss"))


def ingest_documents():
    """Full rebuild of the vector store from every file in documents/.

    Used on first-ever run and from the Settings "Rebuild index" action.
    Ingests file-by-file (rather than one bulk call) so each file's chunk
    ids are known and recorded in the manifest.
    """
    print("Loading documents...")
    embeddings = get_embeddings()
    manifest = {}
    vectorstore = None

    filenames = sorted(
        f for f in os.listdir(DOCUMENTS_DIR)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    )
    print(f"Found {len(filenames)} documents")

    for filename in filenames:
        path = os.path.join(DOCUMENTS_DIR, filename)
        docs = load_document(path)
        chunks = _SPLITTER.split_documents(docs)
        if not chunks:
            continue
        ids = [str(uuid.uuid4()) for _ in chunks]

        if vectorstore is None:
            vectorstore = FAISS.from_documents(chunks, embeddings, ids=ids)
        else:
            vectorstore.add_documents(chunks, ids=ids)

        stat = os.stat(path)
        manifest[filename] = {
            "chunk_ids": ids,
            "chunk_count": len(chunks),
            "size": stat.st_size,
            "ext": os.path.splitext(filename)[1].lower(),
            "category": _infer_category(filename),
            "indexed_at": datetime.now(timezone.utc).isoformat(),
        }
        print(f"  Indexed {filename}: {len(chunks)} chunks")

    if vectorstore is not None:
        os.makedirs(VECTORSTORE_DIR, exist_ok=True)
        vectorstore.save_local(VECTORSTORE_DIR)

    save_manifest(manifest)
    total_chunks = sum(v["chunk_count"] for v in manifest.values())
    print(f"Done! {len(manifest)} documents / {total_chunks} chunks indexed to {VECTORSTORE_DIR}/")
    return manifest


def add_document(path: str) -> dict:
    """Incrementally index a single new file into the existing vector store."""
    filename = os.path.basename(path)
    docs = load_document(path)
    chunks = _SPLITTER.split_documents(docs)
    ids = [str(uuid.uuid4()) for _ in chunks]

    with _LOCK:
        embeddings = get_embeddings()
        if _vectorstore_exists():
            vectorstore = FAISS.load_local(
                VECTORSTORE_DIR, embeddings, allow_dangerous_deserialization=True
            )
            if chunks:
                vectorstore.add_documents(chunks, ids=ids)
        else:
            vectorstore = FAISS.from_documents(chunks, embeddings, ids=ids)

        os.makedirs(VECTORSTORE_DIR, exist_ok=True)
        vectorstore.save_local(VECTORSTORE_DIR)

        manifest = load_manifest()
        stat = os.stat(path)
        entry = {
            "chunk_ids": ids,
            "chunk_count": len(chunks),
            "size": stat.st_size,
            "ext": os.path.splitext(filename)[1].lower(),
            "category": _infer_category(filename),
            "indexed_at": datetime.now(timezone.utc).isoformat(),
        }
        manifest[filename] = entry
        save_manifest(manifest)

    return {"filename": filename, **entry}


def remove_document(filename: str) -> None:
    """Remove a document's chunks from the vector store and delete the file."""
    with _LOCK:
        manifest = load_manifest()
        entry = manifest.pop(filename, None)

        if entry and _vectorstore_exists():
            embeddings = get_embeddings()
            vectorstore = FAISS.load_local(
                VECTORSTORE_DIR, embeddings, allow_dangerous_deserialization=True
            )
            chunk_ids = entry.get("chunk_ids") or []
            if chunk_ids:
                try:
                    vectorstore.delete(ids=chunk_ids)
                    vectorstore.save_local(VECTORSTORE_DIR)
                except ValueError as exc:
                    print(f"[remove_document] delete failed for {filename}: {exc}")

        save_manifest(manifest)

    path = os.path.join(DOCUMENTS_DIR, filename)
    if os.path.exists(path):
        os.remove(path)


def list_documents() -> list:
    """List every file in documents/ with filesystem + manifest metadata."""
    manifest = load_manifest()
    results = []
    if not os.path.isdir(DOCUMENTS_DIR):
        return results

    for filename in sorted(os.listdir(DOCUMENTS_DIR)):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        path = os.path.join(DOCUMENTS_DIR, filename)
        stat = os.stat(path)
        entry = manifest.get(filename)
        results.append({
            "filename": filename,
            "ext": ext,
            "category": entry["category"] if entry and "category" in entry else _infer_category(filename),
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "status": "Indexed" if entry else "Pending",
            "chunk_count": entry["chunk_count"] if entry else 0,
            "indexed_at": entry["indexed_at"] if entry else None,
        })
    return results


if __name__ == "__main__":
    ingest_documents()
