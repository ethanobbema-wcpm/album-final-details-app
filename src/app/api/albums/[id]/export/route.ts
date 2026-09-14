import { getAlbums } from "@/lib/airtable";
import { albumToCsv } from "@/lib/export";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const albums = await getAlbums();
    const album = albums.find((item) => item.airtableId === id || item.id === id);

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const csv = albumToCsv(album);
    const filename = `${album.workingAlbumTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}-final-details.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export album" }, { status: 500 });
  }
}
