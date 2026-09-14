import { airtableMode, createProducer, getProducers } from "@/lib/airtable";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const producers = await getProducers();
    return NextResponse.json({ producers, mode: airtableMode() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load producers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { name?: string; email?: string; company?: string };
    if (!input.name?.trim()) {
      return NextResponse.json({ error: "Producer name is required" }, { status: 400 });
    }
    const producer = await createProducer({
      name: input.name.trim(),
      email: input.email?.trim(),
      company: input.company?.trim()
    });
    return NextResponse.json({ producer, mode: airtableMode() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create producer" }, { status: 400 });
  }
}
