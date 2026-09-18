import { NextResponse } from "next/server";

import { queryRag, relatedDocuments } from "@/lib/server/rag";
import { getSettings, recordQuestion } from "@/lib/server/state";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const question: string = (body.question ?? "").trim();

  if (!question) {
    return NextResponse.json({ answer: "Please enter a valid question.", sources: [], related: [] });
  }

  const settings = getSettings();
  const topK: number = body.top_k ?? settings.top_k;
  const strictMode: boolean = body.strict_mode ?? settings.strict_mode;

  try {
    const { answer, sources } = await queryRag(question, topK, strictMode);
    recordQuestion(question, sources.length);

    return NextResponse.json({
      answer,
      sources,
      related: relatedDocuments(sources.map((s) => s.filename)),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { detail: `Failed to generate an answer: ${detail}` },
      { status: 502 }
    );
  }
}
