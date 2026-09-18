import { NextResponse } from "next/server";

import { CHUNK_OVERLAP, CHUNK_SIZE, EMBEDDING_MODEL, getChunkTotal, getDocuments, getModel, hasApiKey } from "@/lib/server/rag";

const START_TIME = Date.now();

export async function GET() {
  const documents = getDocuments();
  return NextResponse.json({
    status: "ok",
    vectorstore_ready: getChunkTotal() > 0,
    llm_provider: "gemini",
    llm_model: getModel(),
    gemini_api_key_configured: hasApiKey(),
    embedding_model: EMBEDDING_MODEL,
    documents_count: documents.length,
    indexed_chunks: getChunkTotal(),
    chunk_size: CHUNK_SIZE,
    chunk_overlap: CHUNK_OVERLAP,
    uptime_seconds: Math.round((Date.now() - START_TIME) / 1000),
  });
}
