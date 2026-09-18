import { NextResponse } from "next/server";

import { getDocumentText } from "@/lib/server/rag";

const PREVIEW_LIMIT = 4000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);
  const text = getDocumentText(decoded);

  if (text === null) {
    return NextResponse.json({ detail: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    filename: decoded,
    preview: text.slice(0, PREVIEW_LIMIT),
    truncated: text.length > PREVIEW_LIMIT,
  });
}
