import { NextResponse } from "next/server";

import { getSettings, updateSettings } from "@/lib/server/state";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(updateSettings(body));
}
