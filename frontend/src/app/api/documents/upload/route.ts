import { NextResponse } from "next/server";

const READ_ONLY_MESSAGE =
  "This deployment serves a pre-built Knowledge Base index and has no writable storage, " +
  "so uploads are not available here. Add documents with the Python backend locally, " +
  "rebuild the index with build_kb_index.py, then redeploy.";

export async function POST() {
  return NextResponse.json({ detail: READ_ONLY_MESSAGE }, { status: 501 });
}
