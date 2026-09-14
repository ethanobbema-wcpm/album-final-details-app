import { getAlbums, updateAlbumStatus } from "@/lib/airtable";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const albums = await getAlbums();
    const album = albums.find((item) => item.airtableId === id || item.id === id);
    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }
    return NextResponse.json({ album });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load album" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: string };
    if (!body.status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }
    const result = await updateAlbumStatus(id, body.status);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update album" }, { status: 400 });
  }
}
