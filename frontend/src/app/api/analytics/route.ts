import { NextResponse } from "next/server";

import { getChunkTotal, getDocuments } from "@/lib/server/rag";
import { getAnalyticsState } from "@/lib/server/state";

export async function GET() {
  const documents = getDocuments();
  const { totalQuestions, recentActivity } = getAnalyticsState();

  const byCategory: Record<string, number> = {};
  for (const doc of documents) {
    byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
  }

  return NextResponse.json({
    total_documents: documents.length,
    indexed_documents: documents.filter((d) => d.status === "Indexed").length,
    pending_documents: documents.filter((d) => d.status !== "Indexed").length,
    total_chunks: getChunkTotal(),
    total_questions: totalQuestions,
    recent_activity: recentActivity,
    documents_by_category: byCategory,
  });
}
