import { createAlbum, getAlbums, airtableMode } from "@/lib/airtable";
import type { CreateAlbumInput } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const albums = await getAlbums();
    return NextResponse.json({ albums, mode: airtableMode() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load albums" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateAlbumInput;
    const album = await createAlbum(input);
    return NextResponse.json({ album, mode: airtableMode() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create album" }, { status: 400 });
  }
}
