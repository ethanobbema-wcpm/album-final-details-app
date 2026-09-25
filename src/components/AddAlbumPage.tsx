"use client";

import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AUDIO_FILE_ACCEPT,
  isAudioFile,
  readAudioDetails,
  trackTitleFromFileName,
  waveformBars
} from "@/lib/audio-client";
import type { Producer, ProducerListResponse } from "@/lib/types";
import { todayIsoDate } from "@/lib/utils";

type AdminAudioTrack = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  duration: string;
  durationSeconds?: number;
  waveformPeaks?: number[];
};

function reorderAudioTracks(tracks: AdminAudioTrack[], fromId: string, toId: string) {
  const fromIndex = tracks.findIndex((track) => track.id === fromId);
  const toIndex = tracks.findIndex((track) => track.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return tracks;

  const next = [...tracks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function uploadPathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "album";
}

export function AddAlbumPage() {
  const router = useRouter();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [showProducerForm, setShowProducerForm] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AdminAudioTrack[]>([]);
  const [audioProgress, setAudioProgress] = useState("");
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const audioPreviewUrlsRef = useRef<string[]>([]);
  const [albumForm, setAlbumForm] = useState({
    workingAlbumTitle: "",
    catalog: "",
    producerRecordId: "",
    boxFolderUrl: "",
    adminNotes: "",
    dateAssigned: todayIsoDate()
  });
  const [producerForm, setProducerForm] = useState({
    name: "",
    email: "",
    company: ""
  });

  useEffect(() => {
    async function loadProducers() {
      const response = await fetch("/api/producers", { cache: "no-store" });
      const data = (await response.json()) as ProducerListResponse;
      setProducers(data.producers || []);
    }

    void loadProducers();
  }, []);

  useEffect(() => {
    return () => audioPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function addAudioFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const accepted = files.filter(isAudioFile);
    if (!accepted.length) {
      setMessage("Choose WAV, AIFF, MP3, M4A, FLAC, OGG, CAF, or WMA audio files.");
      return;
    }

    const candidates: AdminAudioTrack[] = [];
    setMessage("");

    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setAudioProgress(`Preparing audio file ${index + 1} of ${accepted.length}: ${file.name}`);
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

        const previewUrl = URL.createObjectURL(file);
        audioPreviewUrlsRef.current.push(previewUrl);
        const details = await readAudioDetails(file, previewUrl);
        candidates.push({
          id: `admin-audio-${Date.now()}-${index}`,
          file,
          previewUrl,
          title: trackTitleFromFileName(file.name),
          duration: details.duration,
          durationSeconds: details.durationSeconds,
          waveformPeaks: details.waveformPeaks
        });
      }

      setAudioTracks((current) => [...current, ...candidates]);
      if (accepted.length !== files.length) setMessage("Some files were skipped because they were not supported audio files.");
    } finally {
      setAudioProgress("");
    }
  }

  function updateAudioTrack(id: string, title: string) {
    setAudioTracks((current) => current.map((track) => (track.id === id ? { ...track, title } : track)));
  }

  function moveAudioTrack(id: string, direction: -1 | 1) {
    setAudioTracks((current) => {
      const index = current.findIndex((track) => track.id === id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function removeAudioTrack(id: string) {
    setAudioTracks((current) => {
      const removed = current.find((track) => track.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        audioPreviewUrlsRef.current = audioPreviewUrlsRef.current.filter((url) => url !== removed.previewUrl);
      }
      return current.filter((track) => track.id !== id);
    });
  }

  async function handleCreateAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const uploadedTracks = [];

      for (let index = 0; index < audioTracks.length; index += 1) {
        const track = audioTracks[index];
        const albumPath = uploadPathSegment(albumForm.workingAlbumTitle);
        const filePath = uploadPathSegment(track.file.name);
        const blob = await upload(`album-audio/${albumPath}/${String(index + 1).padStart(2, "0")}-${filePath}`, track.file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
          multipart: true,
          contentType: track.file.type || "application/octet-stream",
          onUploadProgress: ({ percentage }) => {
            setAudioProgress(`Uploading audio file ${index + 1} of ${audioTracks.length}: ${Math.round(percentage)}%`);
          }
        });

        uploadedTracks.push({
          originalTrackTitle: track.title.trim() || trackTitleFromFileName(track.file.name),
          audioFileName: track.file.name,
          audioAttachmentUrl: blob.url,
          duration: track.duration,
          durationSeconds: track.durationSeconds,
          waveformPeaks: track.waveformPeaks,
          audioFileSize: track.file.size,
          audioMimeType: track.file.type || "application/octet-stream"
        });
      }

      if (audioTracks.length) setAudioProgress("Saving album and transferring audio to Airtable...");
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...albumForm,
          tracks: uploadedTracks
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create album");
      const id = data.album.airtableId || data.album.id;
      router.push(`/admin/albums/${encodeURIComponent(id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create album");
      setAudioProgress("");
      setSaving(false);
    }
  }

  async function handleCreateProducer() {
    if (!producerForm.name.trim()) {
      setMessage("Producer name is required.");
      return;
    }

    setMessage("");

    try {
      const response = await fetch("/api/producers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(producerForm)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create producer");
      setProducers((current) => [...current, data.producer].sort((a, b) => a.name.localeCompare(b.name)));
      setAlbumForm((current) => ({ ...current, producerRecordId: data.producer.airtableId || data.producer.id }));
      setProducerForm({ name: "", email: "", company: "" });
      setShowProducerForm(false);
      setMessage("Producer added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create producer");
    }
  }

  return (
    <main className="workflowShell addAlbumShell">
      <h1>Add Album</h1>

      {message ? <div className="notice">{message}</div> : null}

      <form className="workflowForm" onSubmit={handleCreateAlbum}>
        <label className="horizontalField">
          <span>Working Album Title:</span>
          <input
            required
            value={albumForm.workingAlbumTitle}
            onChange={(event) => setAlbumForm((current) => ({ ...current, workingAlbumTitle: event.target.value }))}
          />
        </label>

        <label className="horizontalField">
          <span>Catalog:</span>
          <input
            value={albumForm.catalog}
            onChange={(event) => setAlbumForm((current) => ({ ...current, catalog: event.target.value }))}
          />
        </label>

        <div className="producerFieldRow">
          <label className="horizontalField">
            <span>Producer:</span>
            <select
              value={albumForm.producerRecordId}
              onChange={(event) => setAlbumForm((current) => ({ ...current, producerRecordId: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {producers.map((producer) => (
                <option key={producer.airtableId || producer.id} value={producer.airtableId || producer.id}>
                  {producer.name}
                </option>
              ))}
            </select>
          </label>
          <button className="outlineButton addProducerButton" type="button" onClick={() => setShowProducerForm((value) => !value)}>
            <UserPlus size={20} />
            Add Producer
          </button>
        </div>

        {showProducerForm ? (
          <div className="inlineProducerForm">
            <input
              value={producerForm.name}
              onChange={(event) => setProducerForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Producer name"
              required
            />
            <input
              type="email"
              value={producerForm.email}
              onChange={(event) => setProducerForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
            />
            <input
              value={producerForm.company}
              onChange={(event) => setProducerForm((current) => ({ ...current, company: event.target.value }))}
              placeholder="Company"
            />
            <button className="outlineButton" type="button" onClick={() => void handleCreateProducer()}>
              Save
            </button>
          </div>
        ) : null}

        <div className="addAlbumExtras">
          <label>
            Box Folder URL
            <input
              type="url"
              value={albumForm.boxFolderUrl}
              onChange={(event) => setAlbumForm((current) => ({ ...current, boxFolderUrl: event.target.value }))}
            />
          </label>

          <label>
            Assigned Date
            <input
              type="date"
              value={albumForm.dateAssigned}
              onChange={(event) => setAlbumForm((current) => ({ ...current, dateAssigned: event.target.value }))}
            />
          </label>

          <label className="adminNotesField">
            Notes (optional)
            <textarea
              value={albumForm.adminNotes}
              placeholder="Add any instructions or context for the producer."
              onChange={(event) => setAlbumForm((current) => ({ ...current, adminNotes: event.target.value }))}
            />
          </label>
        </div>

        <section className="adminAudioSection">
          <h2>Initial Audio Mixes (optional)</h2>
          <label
            className={`dropZone audioDropZone ${audioProgress ? "audioDropZoneLoading" : ""}`}
            aria-busy={Boolean(audioProgress)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void addAudioFiles(event.dataTransfer.files);
            }}
          >
            {audioProgress ? (
              <div className="audioLoadingState" role="status" aria-live="polite">
                <Loader2 className="spin" size={30} />
                <span>{audioProgress}</span>
                <small>Large Box files may take a moment to become available.</small>
              </div>
            ) : (
              <>
                <Upload size={30} />
                <span>Drag and Drop Audio Files</span>
                <small>or click to choose files</small>
              </>
            )}
            <input
              type="file"
              accept={AUDIO_FILE_ACCEPT}
              multiple
              disabled={Boolean(audioProgress)}
              onChange={(event) => {
                const input = event.currentTarget;
                void addAudioFiles(input.files || []).finally(() => {
                  input.value = "";
                });
              }}
            />
          </label>

          {audioTracks.length ? (
            <div className="adminAudioList">
              {audioTracks.map((track, index) => {
                const bars = waveformBars(track.waveformPeaks);
                return (
                  <article
                    className="adminAudioTrack"
                    draggable
                    key={track.id}
                    onDragStart={() => setDraggingTrackId(track.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingTrackId) setAudioTracks((current) => reorderAudioTracks(current, draggingTrackId, track.id));
                      setDraggingTrackId(null);
                    }}
                  >
                    <div className="trackHandle" aria-label="Drag track">
                      <GripVertical size={20} />
                    </div>
                    <div className="adminAudioBody">
                      <div className="trackNameRow">
                        <span>{index + 1}.</span>
                        <label>
                          <span className="srOnly">Initial track title</span>
                          <input
                            className="trackTitleInput"
                            value={track.title}
                            onChange={(event) => updateAudioTrack(track.id, event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="waveform adminWaveform" aria-hidden="true">
                        {bars.map((height, barIndex) => (
                          <span className="waveBar" style={{ height: `${height}px` }} key={`${track.id}-${barIndex}`} />
                        ))}
                      </div>
                      <div className="adminAudioMeta">
                        <span>{track.file.name}</span>
                        <span>{track.duration || "Duration unavailable"}</span>
                      </div>
                    </div>
                    <div className="trackButtons">
                      <button type="button" onClick={() => moveAudioTrack(track.id, -1)} aria-label="Move track up">
                        <ArrowUp size={16} />
                      </button>
                      <button type="button" onClick={() => moveAudioTrack(track.id, 1)} aria-label="Move track down">
                        <ArrowDown size={16} />
                      </button>
                      <button type="button" onClick={() => removeAudioTrack(track.id)} aria-label={`Remove ${track.title}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
              <p className="adminAudioPendingNote">Audio files will upload when you click Finish.</p>
            </div>
          ) : null}
        </section>

        <div className="workflowButtonRow">
          <button className="outlineButton" type="submit" disabled={saving || Boolean(audioProgress)}>
            <Plus size={18} />
            Finish
          </button>
          <Link className="outlineButton" href="/admin">
            Back
          </Link>
        </div>
      </form>
    </main>
  );
}
