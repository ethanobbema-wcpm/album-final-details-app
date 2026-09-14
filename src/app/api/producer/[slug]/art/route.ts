import { airtableMode, uploadArtReference } from "@/lib/airtable";
import { NextResponse } from "next/server";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const data = await request.formData();
    const file = data.get("file");
    const caption = data.get("caption");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File must be 4 MB or smaller" }, { status: 413 });
    }

    const result = await uploadArtReference({
      slug,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      arrayBuffer: await file.arrayBuffer(),
      caption: typeof caption === "string" ? caption : undefined
    });

    return NextResponse.json({ ...result, mode: airtableMode() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload art reference" }, { status: 400 });
  }
}
