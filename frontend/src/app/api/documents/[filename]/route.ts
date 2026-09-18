import { NextResponse } from "next/server";

const READ_ONLY_MESSAGE =
  "This deployment serves a pre-built Knowledge Base index and has no writable storage, " +
  "so documents cannot be deleted here. Run the Python backend locally to manage documents, " +
  "then rebuild the index with build_kb_index.py and redeploy.";

export async function DELETE() {
  return NextResponse.json({ detail: READ_ONLY_MESSAGE }, { status: 501 });
}
