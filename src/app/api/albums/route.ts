import { del } from "@vercel/blob";
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
  let stagingUrls: string[] = [];
  try {
    const input = (await request.json()) as CreateAlbumInput;
    stagingUrls = (input.tracks || []).map((track) => track.audioAttachmentUrl || "").filter(Boolean);
    const album = await createAlbum(input);

    if (airtableMode() === "airtable" && stagingUrls.length) {
      const confirmedAttachmentCount = album.tracks.filter(
        (track) => track.audioUrl && !stagingUrls.includes(track.audioUrl)
      ).length;
      if (confirmedAttachmentCount === stagingUrls.length) {
        try {
          await del(stagingUrls);
        } catch (cleanupError) {
          console.error("Unable to remove confirmed staging audio", cleanupError);
        }
      }
    }

    return NextResponse.json({ album, mode: airtableMode() }, { status: 201 });
  } catch (error) {
    if (stagingUrls.length) {
      try {
        await del(stagingUrls);
      } catch (cleanupError) {
        console.error("Unable to remove failed staging audio", cleanupError);
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create album" }, { status: 400 });
  }
}
