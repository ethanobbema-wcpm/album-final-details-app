import { mockAlbums, mockProducers } from "./mock-data";
import type {
  Album,
  ArtReference,
  CreateAlbumInput,
  Producer,
  SubmissionSummary,
  SubmitAlbumInput,
  Track
} from "./types";
import { isoDateTimeMinute, normalizeStatus, slugify, todayIsoDate } from "./utils";

type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = {
  records: AirtableRecord[];
  offset?: string;
};

type AirtableCreateRecordsResponse = {
  records: AirtableRecord[];
};

type AirtableDeleteRecordsResponse = {
  records: Array<{ id: string; deleted: boolean }>;
};

type UploadAttachmentInput = {
  slug: string;
  filename: string;
  contentType: string;
  arrayBuffer: ArrayBuffer;
  caption?: string;
};

const MAX_AIRTABLE_BATCH_SIZE = 10;

export const tableNames = {
  producers: process.env.AIRTABLE_TABLE_PRODUCERS || "Producers",
  albums: process.env.AIRTABLE_TABLE_ALBUMS || "Albums",
  tracks: process.env.AIRTABLE_TABLE_TRACKS || "Tracks",
  artReferences: process.env.AIRTABLE_TABLE_ART_REFERENCES || "Art References",
  submissions: process.env.AIRTABLE_TABLE_SUBMISSIONS || "Submissions"
};

export const statusLabels = {
  assigned: "Assigned",
  completed: "Completed"
} as const;

export function airtableMode() {
  return isAirtableConfigured() ? "airtable" : "mock";
}

export function isAirtableConfigured() {
  return Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
}

function airtableBaseUrl(host = "https://api.airtable.com") {
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!baseId) throw new Error("AIRTABLE_BASE_ID is not set");
  return `${host}/v0/${encodeURIComponent(baseId)}`;
}

function airtableHeaders(extra?: HeadersInit) {
  const token = process.env.AIRTABLE_API_KEY;
  if (!token) throw new Error("AIRTABLE_API_KEY is not set");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function tablePath(tableName: string) {
  return encodeURIComponent(tableName);
}

async function airtableRequest<T>(path: string, init: RequestInit = {}, host?: string): Promise<T> {
  const response = await fetch(`${airtableBaseUrl(host)}${path}`, {
    ...init,
    headers: airtableHeaders(init.headers),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Airtable request failed ${response.status}: ${details}`);
  }

  return (await response.json()) as T;
}

async function listRecords(tableName: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const data = await airtableRequest<AirtableListResponse>(`/${tablePath(tableName)}?${params}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

async function deleteRecords(tableName: string, recordIds: string[]) {
  for (let i = 0; i < recordIds.length; i += MAX_AIRTABLE_BATCH_SIZE) {
    const params = new URLSearchParams();
    recordIds.slice(i, i + MAX_AIRTABLE_BATCH_SIZE).forEach((id) => params.append("records[]", id));

    await airtableRequest<AirtableDeleteRecordsResponse>(`/${tablePath(tableName)}?${params}`, {
      method: "DELETE"
    });
  }
}

function firstString(fields: Record<string, unknown>, names: string[], fallback = "") {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return fallback;
}

function firstStringArray(fields: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = fields[name];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    if (typeof value === "string" && value) return [value];
  }
  return [];
}

function firstNumber(fields: Record<string, unknown>, names: string[], fallback = 0) {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function firstBoolean(fields: Record<string, unknown>, names: string[], fallback = false) {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "yes" || value.toLowerCase() === "true";
  }
  return fallback;
}

function toAttachmentUrl(fields: Record<string, unknown>, name: string) {
  const value = fields[name];
  if (!Array.isArray(value)) return undefined;
  const first = value[0] as { url?: unknown } | undefined;
  return typeof first?.url === "string" ? first.url : undefined;
}

function waveformPeaksFromJson(value: string) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return undefined;
    const peaks = parsed.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    return peaks.length ? peaks : undefined;
  } catch {
    return undefined;
  }
}

function mapProducer(record: AirtableRecord): Producer {
  const fields = record.fields;
  return {
    id: record.id,
    airtableId: record.id,
    producerId: firstString(fields, ["Producer ID"]),
    name: firstString(fields, ["Producer Name", "Name"], "Untitled Producer"),
    email: firstString(fields, ["Email"]),
    phone: firstString(fields, ["Phone"]),
    company: firstString(fields, ["Company"]),
    active: firstBoolean(fields, ["Active"], true),
    defaultContactMethod: firstString(fields, ["Default Contact Method"]),
    notes: firstString(fields, ["Notes"])
  };
}

function mapTrack(record: AirtableRecord): Track {
  const fields = record.fields;
  return {
    id: firstString(fields, ["Track ID"], record.id),
    airtableId: record.id,
    albumRecordId: firstStringArray(fields, ["Album"])[0],
    originalTrackNumber: firstNumber(fields, ["Original Track Number"]),
    currentTrackOrder: firstNumber(fields, ["Current Track Order"], firstNumber(fields, ["Original Track Number"])),
    originalTrackTitle: firstString(fields, ["Original Track Title"], "Untitled Track"),
    finalTrackTitle: firstString(fields, ["Final Track Title"]),
    audioFileName: firstString(fields, ["Audio File Name"]),
    audioUrl: toAttachmentUrl(fields, "Audio Attachment") || firstString(fields, ["Audio URL"]),
    duration: firstString(fields, ["Duration"]),
    durationSeconds: firstNumber(fields, ["Duration Seconds"]) || undefined,
    waveformPeaks: waveformPeaksFromJson(firstString(fields, ["Waveform JSON"])),
    audioFileSize: firstNumber(fields, ["Audio File Size"]) || undefined,
    audioMimeType: firstString(fields, ["Audio MIME Type"]) || undefined,
    producerNotes: firstString(fields, ["Producer Notes"])
  };
}

function mapArtReference(record: AirtableRecord): ArtReference {
  const fields = record.fields;
  return {
    id: firstString(fields, ["Art Reference ID"], record.id),
    airtableId: record.id,
    albumRecordId: firstStringArray(fields, ["Album"])[0],
    uploadedByProducerId: firstStringArray(fields, ["Uploaded By Producer"])[0],
    fileName: firstString(fields, ["File Name"]),
    attachmentUrl: toAttachmentUrl(fields, "Attachment"),
    fileUrl: firstString(fields, ["File URL"]),
    captionOrNotes: firstString(fields, ["Caption Or Notes"]),
    dateUploaded: firstString(fields, ["Date Uploaded"])
  };
}

function mapSubmission(record: AirtableRecord): SubmissionSummary {
  const fields = record.fields;
  const tracklistJson = firstString(fields, ["Tracklist JSON"]);
  return {
    id: firstString(fields, ["Submission ID"], record.id),
    airtableId: record.id,
    albumRecordId: firstStringArray(fields, ["Album"])[0],
    producerRecordId: firstStringArray(fields, ["Producer"])[0],
    submittedFinalAlbumTitle: firstString(fields, ["Submitted Final Album Title"]),
    submittedFinalCatalog: firstString(fields, ["Submitted Final Catalog"]),
    submittedNotes: submissionNotesFromTracklistJson(tracklistJson),
    submittedTrackCount: firstNumber(fields, ["Submitted Track Count"]),
    artReferenceCount: firstNumber(fields, ["Art Reference Count"]),
    status: firstString(fields, ["Status"]),
    submittedAt: firstString(fields, ["Submitted At"]),
    exportReady: firstBoolean(fields, ["Export Ready"]),
    adminReviewNotes: firstString(fields, ["Admin Review Notes"]),
    tracklistJson
  };
}

function submissionNotesFromTracklistJson(tracklistJson?: string) {
  if (!tracklistJson) return "";

  try {
    const payload = JSON.parse(tracklistJson) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
    const metadata = (payload as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
    const notes = (metadata as { notes?: unknown }).notes;
    return typeof notes === "string" ? notes : "";
  } catch {
    return "";
  }
}

function finalCatalogFromTracklistJson(tracklistJson?: string) {
  if (!tracklistJson) return "";

  try {
    const payload = JSON.parse(tracklistJson) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";

    const metadata = (payload as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";

    const finalCatalog = (metadata as { finalCatalog?: unknown }).finalCatalog;
    return typeof finalCatalog === "string" ? finalCatalog : "";
  } catch {
    return "";
  }
}

function finalCatalogFromSubmissions(submissions: SubmissionSummary[]) {
  const sortedSubmissions = [...submissions].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

  for (const submission of sortedSubmissions) {
    const finalCatalog = submission.submittedFinalCatalog || finalCatalogFromTracklistJson(submission.tracklistJson);
    if (finalCatalog.trim()) return finalCatalog.trim();
  }

  return "";
}

function submissionNotesFromSubmissions(submissions: SubmissionSummary[]) {
  const sortedSubmissions = [...submissions].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  for (const submission of sortedSubmissions) {
    const notes = submission.submittedNotes || submissionNotesFromTracklistJson(submission.tracklistJson);
    if (notes.trim()) return notes.trim();
  }
  return "";
}

function mapAlbum(
  record: AirtableRecord,
  producerById: Map<string, Producer>,
  tracksByAlbum: Map<string, Track[]>,
  artByAlbum: Map<string, ArtReference[]>,
  submissionsByAlbum: Map<string, SubmissionSummary[]>
): Album {
  const fields = record.fields;
  const producerRecordId = firstStringArray(fields, ["Producer"])[0];
  const producer = producerRecordId ? producerById.get(producerRecordId) : undefined;
  const submissions = submissionsByAlbum.get(record.id) || [];

  return {
    id: firstString(fields, ["Album ID"], record.id),
    airtableId: record.id,
    workingAlbumTitle: firstString(fields, ["Working Album Title"], "Untitled Album"),
    finalAlbumTitle: firstString(fields, ["Final Album Title"]),
    catalog: firstString(fields, ["Catalog"]),
    finalCatalog: firstString(fields, ["Final Catalog"]) || finalCatalogFromSubmissions(submissions),
    producerRecordId,
    producerId: producer?.producerId || firstString(fields, ["Producer ID (from Producer)", "Producer ID (from Producer) (from Album)"]),
    producerName:
      producer?.name ||
      firstString(fields, ["Producer Name", "Producer Name (from Producer)", "Producer Name (from Producer) (from Album)"]),
    producerEmail: producer?.email || firstString(fields, ["Email", "Email (from Producer)", "Email (from Producer) (from Album)"]),
    boxFolderUrl: firstString(fields, ["Box Folder URL"]),
    status: normalizeStatus(firstString(fields, ["Status"], statusLabels.assigned)),
    dateAssigned: firstString(fields, ["Date Assigned"]),
    dateSubmitted: firstString(fields, ["Date Submitted"]),
    privateSubmissionSlug: firstString(fields, ["Private Submission Slug"], record.id),
    adminNotes: firstString(fields, ["Admin Notes"]),
    submissionNotes: submissionNotesFromSubmissions(submissions),
    downloadPackageUrl: firstString(fields, ["Download Package URL"]),
    lastUpdated: firstString(fields, ["Last Updated"]),
    tracks: (tracksByAlbum.get(record.id) || []).sort((a, b) => a.currentTrackOrder - b.currentTrackOrder),
    artReferences: artByAlbum.get(record.id) || [],
    submissions
  };
}

function groupByAlbum<T extends { albumRecordId?: string }>(items: T[]) {
  return items.reduce((map, item) => {
    if (!item.albumRecordId) return map;
    const existing = map.get(item.albumRecordId) || [];
    existing.push(item);
    map.set(item.albumRecordId, existing);
    return map;
  }, new Map<string, T[]>());
}

export async function getProducers(): Promise<Producer[]> {
  if (!isAirtableConfigured()) return mockProducers;

  const records = await listRecords(tableNames.producers);
  return records.map(mapProducer).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAlbums(): Promise<Album[]> {
  if (!isAirtableConfigured()) return mockAlbums;

  const [producerRecords, albumRecords, trackRecords, artRecords, submissionRecords] = await Promise.all([
    listRecords(tableNames.producers),
    listRecords(tableNames.albums),
    listRecords(tableNames.tracks),
    listRecords(tableNames.artReferences),
    listRecords(tableNames.submissions)
  ]);

  const producers = producerRecords.map(mapProducer);
  const producerById = new Map(producers.map((producer) => [producer.airtableId || producer.id, producer]));
  const tracksByAlbum = groupByAlbum(trackRecords.map(mapTrack));
  const artByAlbum = groupByAlbum(artRecords.map(mapArtReference));
  const submissionsByAlbum = groupByAlbum(submissionRecords.map(mapSubmission));

  return albumRecords
    .map((record) => mapAlbum(record, producerById, tracksByAlbum, artByAlbum, submissionsByAlbum))
    .sort((a, b) => (b.dateAssigned || "").localeCompare(a.dateAssigned || ""));
}

export async function getAlbumBySlug(slug: string) {
  const albums = await getAlbums();
  return albums.find((album) => album.privateSubmissionSlug === slug);
}

export async function createProducer(input: { name: string; email?: string; company?: string }) {
  if (!isAirtableConfigured()) {
    const producer = {
      id: `mock-prod-${Date.now()}`,
      airtableId: `mock-prod-${Date.now()}`,
      producerId: `PROD-${Date.now().toString().slice(-6)}`,
      name: input.name,
      email: input.email || "",
      company: input.company || "",
      active: true,
      defaultContactMethod: "Email"
    } satisfies Producer;
    mockProducers.push(producer);
    return producer;
  }

  const data = await airtableRequest<{ records: AirtableRecord[] }>(`/${tablePath(tableNames.producers)}`, {
    method: "POST",
    body: JSON.stringify({
      records: [
        {
          fields: {
            "Producer Name": input.name,
            "Producer ID": `PROD-${Date.now().toString().slice(-6)}`,
            Email: input.email || "",
            Company: input.company || "",
            Active: true,
            "Default Contact Method": "Email"
          }
        }
      ]
    })
  });

  return mapProducer(data.records[0]);
}

export async function createAlbum(input: CreateAlbumInput) {
  if (!input.workingAlbumTitle.trim()) {
    throw new Error("Working album title is required");
  }

  const inputTracks = input.tracks || [];

  if (!isAirtableConfigured()) {
    const producer = mockProducers.find((item) => item.airtableId === input.producerRecordId);
    const album: Album = {
      id: `mock-alb-${Date.now()}`,
      airtableId: `mock-alb-${Date.now()}`,
      workingAlbumTitle: input.workingAlbumTitle,
      catalog: input.catalog,
      producerRecordId: producer?.airtableId,
      producerName: producer?.name || input.producerName,
      producerEmail: producer?.email,
      boxFolderUrl: input.boxFolderUrl,
      adminNotes: input.adminNotes?.trim() || undefined,
      status: statusLabels.assigned,
      dateAssigned: input.dateAssigned || todayIsoDate(),
      privateSubmissionSlug: slugify(input.workingAlbumTitle),
      tracks: inputTracks.map((track, index) => ({
        id: `mock-trk-${Date.now()}-${index}`,
        airtableId: `mock-trk-${Date.now()}-${index}`,
        originalTrackNumber: index + 1,
        currentTrackOrder: index + 1,
        originalTrackTitle: track.originalTrackTitle,
        finalTrackTitle: "",
        audioFileName: track.audioFileName,
        audioUrl: track.audioAttachmentUrl || track.audioUrl,
        duration: track.duration,
        durationSeconds: track.durationSeconds,
        waveformPeaks: track.waveformPeaks,
        audioFileSize: track.audioFileSize,
        audioMimeType: track.audioMimeType
      })),
      artReferences: [],
      submissions: []
    };
    mockAlbums.unshift(album);
    return album;
  }

  const albumCreate = await airtableRequest<{ records: AirtableRecord[] }>(`/${tablePath(tableNames.albums)}`, {
    method: "POST",
    body: JSON.stringify({
      records: [
        {
          fields: {
            "Working Album Title": input.workingAlbumTitle,
            Catalog: input.catalog || "",
            ...(input.producerRecordId ? { Producer: [input.producerRecordId] } : {}),
            "Box Folder URL": input.boxFolderUrl || "",
            ...(input.adminNotes?.trim() ? { "Admin Notes": input.adminNotes.trim() } : {}),
            Status: statusLabels.assigned,
            "Date Assigned": input.dateAssigned || todayIsoDate(),
            "Private Submission Slug": slugify(input.workingAlbumTitle),
            "Last Updated": todayIsoDate()
          }
        }
      ]
    })
  });

  const albumRecord = albumCreate.records[0];
  const trackPayloads = inputTracks.map((track, index) => ({
    fields: {
      "Track ID": `TRK-${Date.now().toString().slice(-6)}-${String(index + 1).padStart(2, "0")}`,
      Album: [albumRecord.id],
      "Original Track Number": index + 1,
      "Current Track Order": index + 1,
      "Original Track Title": track.originalTrackTitle,
      "Final Track Title": "",
      "Audio File Name": track.audioFileName || "",
      ...(track.audioAttachmentUrl
        ? { "Audio Attachment": [{ url: track.audioAttachmentUrl, filename: track.audioFileName || track.originalTrackTitle }] }
        : {}),
      ...(track.audioUrl ? { "Audio URL": track.audioUrl } : {}),
      Duration: track.duration || "",
      ...(track.durationSeconds ? { "Duration Seconds": track.durationSeconds } : {}),
      ...(track.waveformPeaks?.length ? { "Waveform JSON": JSON.stringify(track.waveformPeaks) } : {}),
      ...(track.audioFileSize ? { "Audio File Size": track.audioFileSize } : {}),
      ...(track.audioMimeType ? { "Audio MIME Type": track.audioMimeType } : {})
    }
  }));

  const createdTrackRecordIds: string[] = [];
  try {
    for (let i = 0; i < trackPayloads.length; i += MAX_AIRTABLE_BATCH_SIZE) {
      const createdTracks = await airtableRequest<AirtableCreateRecordsResponse>(`/${tablePath(tableNames.tracks)}`, {
        method: "POST",
        body: JSON.stringify({ records: trackPayloads.slice(i, i + MAX_AIRTABLE_BATCH_SIZE) })
      });
      createdTrackRecordIds.push(...createdTracks.records.map((record) => record.id));
    }
  } catch (error) {
    await deleteRecords(tableNames.tracks, createdTrackRecordIds);
    await deleteRecords(tableNames.albums, [albumRecord.id]);
    throw error;
  }

  const albums = await getAlbums();
  const createdAlbum = albums.find((album) => album.airtableId === albumRecord.id);
  if (!createdAlbum) throw new Error("Album was created but could not be reloaded from Airtable");
  return createdAlbum;
}

export async function updateAlbumStatus(id: string, status: string) {
  const nextStatus = normalizeStatus(status);

  if (!isAirtableConfigured()) {
    const album = mockAlbums.find((item) => item.airtableId === id || item.id === id);
    if (album) album.status = nextStatus;
    return { id, status: nextStatus };
  }

  await airtableRequest<AirtableRecord>(`/${tablePath(tableNames.albums)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        Status: nextStatus,
        "Last Updated": todayIsoDate()
      }
    })
  });

  return { id, status: nextStatus };
}

export async function deleteAlbum(id: string) {
  if (!isAirtableConfigured()) {
    const index = mockAlbums.findIndex((item) => item.airtableId === id || item.id === id);
    if (index === -1) throw new Error("Album not found");

    const [deletedAlbum] = mockAlbums.splice(index, 1);
    return { id: deletedAlbum.airtableId || deletedAlbum.id, deleted: true };
  }

  const albums = await getAlbums();
  const album = albums.find((item) => item.airtableId === id || item.id === id);
  if (!album?.airtableId) throw new Error("Album not found");

  await deleteRecords(
    tableNames.submissions,
    album.submissions.map((submission) => submission.airtableId).filter((recordId): recordId is string => Boolean(recordId))
  );
  await deleteRecords(
    tableNames.artReferences,
    album.artReferences.map((reference) => reference.airtableId).filter((recordId): recordId is string => Boolean(recordId))
  );
  await deleteRecords(
    tableNames.tracks,
    album.tracks.map((track) => track.airtableId).filter((recordId): recordId is string => Boolean(recordId))
  );
  await deleteRecords(tableNames.albums, [album.airtableId]);

  return { id: album.airtableId, deleted: true };
}

export async function submitAlbumBySlug(slug: string, input: SubmitAlbumInput) {
  const album = await getAlbumBySlug(slug);
  if (!album) throw new Error("Album not found");
  if (!album.artReferences.length) throw new Error("At least one album art inspiration image is required.");

  if (!isAirtableConfigured()) {
    const submittedTracks = input.tracks
      .sort((a, b) => a.currentTrackOrder - b.currentTrackOrder)
      .map((incoming, index) => {
        const existing = album.tracks.find((track) => track.id === incoming.id || track.airtableId === incoming.airtableId);
        const generatedId = `mock-trk-${Date.now()}-${index}`;

        return {
          id: existing?.id || generatedId,
          airtableId: existing?.airtableId || generatedId,
          albumRecordId: album.airtableId || album.id,
          originalTrackNumber: existing?.originalTrackNumber || index + 1,
          currentTrackOrder: index + 1,
          originalTrackTitle: existing?.originalTrackTitle || incoming.originalTrackTitle || incoming.finalTrackTitle,
          finalTrackTitle: incoming.finalTrackTitle,
          audioFileName: existing?.audioFileName || incoming.audioFileName,
          audioUrl: existing?.audioUrl || incoming.audioUrl,
          duration: existing?.duration || incoming.duration,
          producerNotes: incoming.producerNotes
        } satisfies Track;
      });

    const updatedAlbum: Album = {
      ...album,
      finalAlbumTitle: input.finalAlbumTitle,
      finalCatalog: input.finalCatalog?.trim() || "",
      submissionNotes: input.notes?.trim() || "",
      status: statusLabels.completed,
      dateSubmitted: todayIsoDate(),
      tracks: submittedTracks
    };
    const index = mockAlbums.findIndex((item) => item.privateSubmissionSlug === slug);
    if (index !== -1) mockAlbums[index] = updatedAlbum;
    return { album: updatedAlbum };
  }

  if (!album.airtableId) throw new Error("Album record ID is missing");

  await airtableRequest<AirtableRecord>(`/${tablePath(tableNames.albums)}/${encodeURIComponent(album.airtableId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        "Final Album Title": input.finalAlbumTitle,
        Status: statusLabels.completed,
        "Date Submitted": todayIsoDate(),
        "Last Updated": todayIsoDate()
      }
    })
  });

  const trackUpdates = input.tracks
    .filter((track) => track.airtableId)
    .map((track) => ({
      id: track.airtableId,
      fields: {
        "Current Track Order": track.currentTrackOrder,
        "Final Track Title": track.finalTrackTitle,
        "Audio File Name": track.audioFileName || "",
        "Audio URL": track.audioUrl || "",
        Duration: track.duration || "",
        "Producer Notes": track.producerNotes || ""
      }
    }));

  for (let i = 0; i < trackUpdates.length; i += MAX_AIRTABLE_BATCH_SIZE) {
    await airtableRequest<AirtableCreateRecordsResponse>(`/${tablePath(tableNames.tracks)}`, {
      method: "PATCH",
      body: JSON.stringify({ records: trackUpdates.slice(i, i + MAX_AIRTABLE_BATCH_SIZE) })
    });
  }

  const trackCreates = input.tracks
    .filter((track) => !track.airtableId)
    .sort((a, b) => a.currentTrackOrder - b.currentTrackOrder)
    .map((track, index) => ({
      fields: {
        "Track ID": `TRK-${Date.now().toString().slice(-6)}-${String(index + 1).padStart(2, "0")}`,
        Album: [album.airtableId],
        "Original Track Number": track.currentTrackOrder,
        "Current Track Order": track.currentTrackOrder,
        "Original Track Title": track.originalTrackTitle || track.finalTrackTitle,
        "Final Track Title": track.finalTrackTitle,
        "Audio File Name": track.audioFileName || "",
        "Audio URL": track.audioUrl || "",
        Duration: track.duration || "",
        "Producer Notes": track.producerNotes || ""
      }
    }));

  for (let i = 0; i < trackCreates.length; i += MAX_AIRTABLE_BATCH_SIZE) {
    await airtableRequest<AirtableCreateRecordsResponse>(`/${tablePath(tableNames.tracks)}`, {
      method: "POST",
      body: JSON.stringify({ records: trackCreates.slice(i, i + MAX_AIRTABLE_BATCH_SIZE) })
    });
  }

  const tracklistJson = JSON.stringify(
    {
      metadata: {
        finalAlbumTitle: input.finalAlbumTitle,
        finalCatalog: input.finalCatalog?.trim() || "",
        notes: input.notes?.trim() || ""
      },
      tracks: [...input.tracks].sort((a, b) => a.currentTrackOrder - b.currentTrackOrder).map((track) => ({
        order: track.currentTrackOrder,
        title: track.finalTrackTitle
      }))
    }
  );

  await airtableRequest<AirtableCreateRecordsResponse>(`/${tablePath(tableNames.submissions)}`, {
    method: "POST",
    body: JSON.stringify({
      records: [
        {
          fields: {
            "Submission ID": `SUB-${Date.now().toString().slice(-6)}`,
            Album: [album.airtableId],
            ...(album.producerRecordId ? { Producer: [album.producerRecordId] } : {}),
            "Submitted Final Album Title": input.finalAlbumTitle,
            "Submitted Track Count": input.tracks.length,
            "Art Reference Count": input.artReferenceCount,
            Status: statusLabels.completed,
            "Submitted At": isoDateTimeMinute(),
            "Export Ready": true,
            "Tracklist JSON": tracklistJson
          }
        }
      ]
    })
  });

  return { album: await getAlbumBySlug(slug) };
}

export async function uploadArtReference(input: UploadAttachmentInput) {
  const album = await getAlbumBySlug(input.slug);
  if (!album) throw new Error("Album not found");

  if (!isAirtableConfigured()) {
    const artReference: ArtReference = {
      id: `mock-art-${Date.now()}`,
      airtableId: `mock-art-${Date.now()}`,
      albumRecordId: album.airtableId || album.id,
      uploadedByProducerId: album.producerRecordId,
      fileName: input.filename,
      captionOrNotes: input.caption || "",
      dateUploaded: todayIsoDate()
    };
    const index = mockAlbums.findIndex((item) => item.privateSubmissionSlug === input.slug);
    if (index !== -1) {
      mockAlbums[index] = {
        ...mockAlbums[index],
        artReferences: [...mockAlbums[index].artReferences, artReference]
      };
    }

    return {
      id: artReference.id,
      filename: input.filename,
      uploaded: true
    };
  }

  if (!album.airtableId) throw new Error("Album record ID is missing");

  const createData = await airtableRequest<{ records: AirtableRecord[] }>(`/${tablePath(tableNames.artReferences)}`, {
    method: "POST",
    body: JSON.stringify({
      records: [
        {
          fields: {
            "Art Reference ID": `ART-${Date.now().toString().slice(-6)}`,
            Album: [album.airtableId],
            ...(album.producerRecordId ? { "Uploaded By Producer": [album.producerRecordId] } : {}),
            "File Name": input.filename,
            "Caption Or Notes": input.caption || "",
            "Date Uploaded": todayIsoDate()
          }
        }
      ]
    })
  });

  const recordId = createData.records[0].id;
  const base64File = Buffer.from(input.arrayBuffer).toString("base64");
  const uploadPath = `/${encodeURIComponent(recordId)}/${encodeURIComponent("Attachment")}/uploadAttachment`;

  await airtableRequest<AirtableRecord>(
    uploadPath,
    {
      method: "POST",
      body: JSON.stringify({
        contentType: input.contentType,
        file: base64File,
        filename: input.filename
      })
    },
    "https://content.airtable.com"
  );

  return {
    id: recordId,
    filename: input.filename,
    uploaded: true
  };
}
