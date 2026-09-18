import { NextResponse } from "next/server";

import { getDocuments } from "@/lib/server/rag";

export async function GET() {
  return NextResponse.json({ documents: getDocuments() });
}
