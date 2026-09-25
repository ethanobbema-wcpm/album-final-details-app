import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!pathname.startsWith("album-audio/")) throw new Error("Invalid audio upload path");

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ["audio/*", "application/octet-stream"],
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: ["audio/*", "application/octet-stream"],
            maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
            addRandomSuffix: true
          }
        };
      },
      onUploadCompleted: async () => {
        // Airtable attachment creation is finalized by the album API request.
      }
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to authorize audio upload" }, { status: 400 });
  }
}
