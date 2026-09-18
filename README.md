# 🛡️ TechCore IT — Knowledge Assistant

An AI-powered IT Support Knowledge Base built on Retrieval-Augmented Generation (RAG). Ask any IT support question and get instant, cited answers sourced directly from your organization's documentation — plus a Knowledge Base manager, usage analytics, and a premium chat UI.

---

## 🧠 How It Works

```
User Question
     ↓
Convert to vector embedding
     ↓
Search FAISS vector database
     ↓
Retrieve top-k relevant document chunks
     ↓
Stream chunks + question to Google Gemini
     ↓
Generate grounded answer with source citations
```

The LLM only answers from the indexed documents — it cannot hallucinate or use outside knowledge (unless Strict mode is turned off in Settings). If the answer isn't in the documents, it says so and redirects to the helpdesk.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| LLM | Google Gemini (via `langchain-google-genai`) |
| RAG Framework | LangChain (LCEL) |
| Vector Database | FAISS (local) |
| Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| Backend API | FastAPI |
| Language | Python 3.13 · TypeScript |

The frontend and backend are fully decoupled: the Next.js app talks to the FastAPI service exclusively over HTTP (`fetch`/streaming), with no RAG logic duplicated in the UI layer.

---

## 📁 Project structure

```
.
├── backend.py            # FastAPI app — chat, knowledge base, settings, analytics
├── rag_pipeline.py        # LangChain RAG chain (retrieval + Gemini) + streaming
├── ingest.py              # Document loading, chunking, FAISS indexing, manifest
├── documents/             # Seed knowledge base documents (.txt/.md/.pdf)
├── vectorstore/           # Generated FAISS index + manifest (gitignored)
├── requirements.txt
├── .env.example           # GEMINI_API_KEY, GEMINI_MODEL, CORS_ORIGINS
└── frontend/               # Next.js app
    ├── src/app/            # Chat, Knowledge Base, Analytics, Settings pages
    ├── src/components/     # Chat UI, Knowledge Base UI, shared shadcn/ui components
    ├── src/lib/            # API client, types, zustand chat store, hooks
    └── .env.local.example  # NEXT_PUBLIC_API_URL
```

---

## 🚀 Getting started

### 1. Backend (FastAPI + RAG)

```bash
python -m venv venv && source venv/bin/activate   # or use an existing venv
pip install -r requirements.txt

cp .env.example .env
# edit .env and set GEMINI_API_KEY=<your key> (https://aistudio.google.com/apikey)

uvicorn backend:app --port 8000
```

On first run, the backend automatically chunks and indexes every file in `documents/` into `vectorstore/`. The API is now live at `http://localhost:8000` (see `/health`, `/ask`, `/documents`, `/analytics`, `/settings`).

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # defaults to http://localhost:8000

npm run dev
```

Open `http://localhost:3000`.

---

## ☁️ Deploying

There are two supported deployment modes.

### Mode 1 — Vercel only (serverless, no separate backend)

This is what the live deployment uses. Vercel cannot run `backend.py`: torch, FAISS and sentence-transformers together blow past the serverless bundle limit. Instead the Next.js app serves the RAG pipeline itself from `frontend/src/app/api/*`, backed by a **pre-built embedding index** committed at `frontend/src/data/kb-index.json`.

```bash
./venv/bin/python build_kb_index.py   # re-run whenever documents/ changes
cd frontend && npx vercel --prod
```

`build_kb_index.py` chunks `documents/` with exactly the same splitter as `ingest.py`, but embeds with the Gemini embedding API rather than a local model — so the API route can embed the incoming question the same way and compare vectors directly, with no model weights at runtime. Searching 280 chunks by dot product in memory is faster than loading any index.

What to set on Vercel:

- **`GEMINI_API_KEY`** — server-side only. Never prefix it with `NEXT_PUBLIC_`, which would inline it into the browser bundle.
- **Leave `NEXT_PUBLIC_API_URL` unset.** Unset means same-origin `/api`, which routes requests to the built-in pipeline; setting it points the UI at an external backend instead.

Known limits of this mode, by design: **document upload, delete and reindex return HTTP 501**, because serverless instances have no writable disk — add documents locally, re-run `build_kb_index.py`, then redeploy. Analytics counters live in memory, so they reset when an instance is recycled and aren't shared across concurrent instances.

### Mode 2 — split services (full feature set)

Deploy the frontend and the Python backend as two services (e.g. Vercel + Render/Railway/Fly.io, or any Docker host). This keeps local embeddings, FAISS, and working document uploads; the backend needs roughly 1 GB of RAM for torch plus the embedding model. A few things that matter in production but not in local dev:

- **`NEXT_PUBLIC_API_URL` is baked in at build time**, not read at runtime — it's a client-side var, so set it in your hosting platform *before* the build, pointing at your deployed backend's public URL. Changing it later requires a rebuild, not just a restart.
- **`CORS_ORIGINS` on the backend must list your deployed frontend's real origin** (comma-separated for multiple), e.g. `CORS_ORIGINS=https://your-app.vercel.app`. The `http://localhost:3000` default only works locally.
- **`GEMINI_API_KEY` is backend-only** — set it as a server-side environment variable on whatever host runs `backend.py`. It is never sent to or readable from the browser.
- **`documents/` and `vectorstore/` need persistent storage** on the backend host. `vectorstore/` is rebuilt automatically from `documents/` on first boot if missing, but re-uploaded Knowledge Base files won't survive a redeploy unless the host's filesystem (or a mounted volume) persists across deploys.
- Python dependencies in `requirements.txt` are version-pinned and verified against a clean install; Node dependencies install via `npm ci` from `package-lock.json`.

---

## 📄 Knowledge Base documents

The assistant ships with 8 seed IT support documents:

- IT Support Standard Operating Procedures
- Network Troubleshooting Guide
- User Onboarding and Offboarding Guide
- IT Security Policy
- Microsoft 365 Administration Guide
- Hardware and Asset Management Guide
- Server and Infrastructure Management Guide
- IT Helpdesk FAQ

Add, remove, search, or rebuild the index at any time from the **Knowledge Base** page in the app.

---

## 💬 Example questions

```
How do I reset a user's Active Directory password?
What should I do if I suspect a phishing email?
How do I onboard a new employee?
What is the escalation process for a P1 incident?
How do I connect to the company VPN?
What is the password policy?
How do I set up MFA?
My laptop is running slow. What should I do?
How do I create a shared mailbox?
What should I do if my computer has malware?
```

---

## 🔒 Key features

- **Grounded answers, streamed token-by-token** — Gemini only answers from indexed documents by default; no hallucination
- **Source citations** — every answer shows which document (and how relevant it was) it came from, with an expandable preview
- **Honest fallback** — redirects to the helpdesk when the answer isn't in the documents
- **Knowledge Base manager** — drag-and-drop upload with real progress, search/filter/sort, per-file detail view, reindexing
- **Analytics dashboard** — real indexing coverage, file-type breakdown, and recent activity (no simulated metrics)
- **Configurable retrieval** — adjust chunks-per-question and strict/relaxed mode from Settings
- **Conversation history** — multiple chats persisted locally in the browser
- **Clean architecture** — FastAPI + LangChain backend fully decoupled from the Next.js frontend

---
