import { airtableMode, getAlbumBySlug } from "@/lib/airtable";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const album = await getAlbumBySlug(slug);

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    return NextResponse.json({ album, mode: airtableMode() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load album" }, { status: 500 });
  }
}
