import { airtableMode, submitAlbumBySlug } from "@/lib/airtable";
import type { SubmitAlbumInput } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const input = (await request.json()) as SubmitAlbumInput;

    if (!input.finalAlbumTitle?.trim()) {
      return NextResponse.json({ error: "Final album title is required" }, { status: 400 });
    }

    const result = await submitAlbumBySlug(slug, input);
    return NextResponse.json({ ...result, mode: airtableMode() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit album" }, { status: 400 });
  }
}
