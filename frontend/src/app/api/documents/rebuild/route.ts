import { NextResponse } from "next/server";

const READ_ONLY_MESSAGE =
  "The index is pre-built at deploy time and cannot be rebuilt from the browser. " +
  "Run build_kb_index.py locally and redeploy to refresh it.";

export async function POST() {
  return NextResponse.json({ detail: READ_ONLY_MESSAGE }, { status: 501 });
}
