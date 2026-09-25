"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AUDIO_FILE_ACCEPT,
  formatDuration,
  isAudioFile,
  readAudioDetails,
  trackTitleFromFileName,
  waveformBars
} from "@/lib/audio-client";
import type { Album, Track } from "@/lib/types";

type ProducerSubmissionProps = {
  slug?: string;
  albumId?: string;
  backHref?: string;
};

type UploadCandidate = {
  file: File;
  caption: string;
  previewUrl: string;
};

type EditableTrack = Track & {
  audioPreviewUrl?: string;
  durationSeconds?: number;
  waveformPeaks?: number[];
};

type PlaybackState = {
  currentTime: number;
  duration: number;
};

const MAX_ART_FILE_BYTES = 4 * 1024 * 1024;
const WAITING_FOR_AUDIO_FILES_MESSAGE = "Waiting for Finder / Box to provide the selected files...";

function reorderTracks(tracks: EditableTrack[], fromId: string, toId: string) {
  const fromIndex = tracks.findIndex((track) => track.id === fromId);
  const toIndex = tracks.findIndex((track) => track.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return tracks;

  const next = [...tracks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((track, index) => ({ ...track, currentTrackOrder: index + 1 }));
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function parseDuration(duration?: string) {
  if (!duration) return 0;

  const parts = duration.split(":").map((part) => Number(part));
  if (!parts.length || parts.some((part) => Number.isNaN(part))) return 0;

  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function savedTracksForAlbum(album: Album) {
  const availableTracks = album.status === "Completed" ? album.tracks : album.tracks.filter((track) => Boolean(track.audioUrl));
  if (!availableTracks.length) return [];

  return [...availableTracks]
    .sort((a: Track, b: Track) => a.currentTrackOrder - b.currentTrackOrder)
    .map((track: Track, index: number) => ({
      ...track,
      currentTrackOrder: index + 1,
      finalTrackTitle: track.finalTrackTitle || track.originalTrackTitle
    }));
}

export function ProducerSubmission({ slug, albumId, backHref }: ProducerSubmissionProps) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<EditableTrack[]>([]);
  const [finalAlbumTitle, setFinalAlbumTitle] = useState("");
  const [finalCatalog, setFinalCatalog] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [uploads, setUploads] = useState<UploadCandidate[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState("");
  const [playbackByTrack, setPlaybackByTrack] = useState<Record<string, PlaybackState>>({});
  const [audioUploadMessage, setAudioUploadMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<{ trackId: string; time: number } | null>(null);
  const audioPreviewUrlsRef = useRef<string[]>([]);
  const artPreviewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    async function loadAlbum() {
      setLoading(true);
      setError("");

      try {
        const endpoint = albumId
          ? `/api/albums/${encodeURIComponent(albumId)}`
          : slug
            ? `/api/producer/${encodeURIComponent(slug)}`
            : "";

        if (!endpoint) throw new Error("Album link is missing");

        const response = await fetch(endpoint, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Album not found");

        setAlbum(data.album);
        setFinalAlbumTitle(data.album.finalAlbumTitle || "");
        setFinalCatalog(data.album.finalCatalog || "");
        setSubmissionNotes(data.album.submissionNotes || "");
        setTracks(savedTracksForAlbum(data.album));
        setPlayingTrackId(null);
        setActiveAudioUrl("");
        setPlaybackByTrack({});
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load album");
      } finally {
        setLoading(false);
      }
    }

    void loadAlbum();
  }, [albumId, slug]);

  useEffect(() => {
    return () => {
      audioPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      artPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (audioUploadMessage !== WAITING_FOR_AUDIO_FILES_MESSAGE) return;

    function clearWaitingMessage() {
      window.setTimeout(() => {
        setAudioUploadMessage((current) => (current === WAITING_FOR_AUDIO_FILES_MESSAGE ? "" : current));
      }, 2500);
    }

    window.addEventListener("focus", clearWaitingMessage);
    return () => window.removeEventListener("focus", clearWaitingMessage);
  }, [audioUploadMessage]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeAudioUrl || !playingTrackId) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      pendingSeekRef.current = null;
      return;
    }

    audio.src = activeAudioUrl;
    audio.load();
    void audio.play().catch(() => {
      setPlayingTrackId(null);
      setActiveAudioUrl("");
      setError("Audio playback could not start in this browser.");
    });
  }, [activeAudioUrl, playingTrackId]);

  const submissionSlug = album?.privateSubmissionSlug || slug || "";
  const existingArtReferenceCount = album?.artReferences.length || 0;
  const albumHasStoredAudio = Boolean(album?.tracks.some((track) => track.audioUrl));
  const savedArtReferences = [...(album?.artReferences || [])].sort((a, b) => (a.dateUploaded || "").localeCompare(b.dateUploaded || ""));

  function updateTrack(id: string, update: Partial<EditableTrack>) {
    setTracks((current) => current.map((track) => (track.id === id ? { ...track, ...update } : track)));
  }

  function durationForTrack(track: EditableTrack) {
    const playback = playbackByTrack[track.id];
    if (playback?.duration > 0) return playback.duration;
    return track.durationSeconds || parseDuration(track.duration);
  }

  function currentTimeForTrack(track: EditableTrack) {
    return playbackByTrack[track.id]?.currentTime || 0;
  }

  function savePlayback(trackId: string, currentTime: number, duration: number) {
    setPlaybackByTrack((current) => ({
      ...current,
      [trackId]: { currentTime, duration }
    }));
  }

  function saveActivePlayback() {
    const audio = audioRef.current;
    if (!audio || !playingTrackId) return;

    const activeTrack = tracks.find((item) => item.id === playingTrackId);
    savePlayback(
      playingTrackId,
      Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : activeTrack
          ? durationForTrack(activeTrack)
          : 0
    );
  }

  function toggleTrackPlayback(track: EditableTrack) {
    const source = track.audioPreviewUrl || track.audioUrl;
    if (!source) {
      setError("Drop the audio file here to preview playback.");
      return;
    }

    if (playingTrackId === track.id) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        savePlayback(
          track.id,
          Number.isFinite(audio.currentTime) ? audio.currentTime : currentTimeForTrack(track),
          Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : durationForTrack(track)
        );
      }
      setPlayingTrackId(null);
      setActiveAudioUrl("");
      return;
    }

    saveActivePlayback();

    pendingSeekRef.current = { trackId: track.id, time: currentTimeForTrack(track) };
    setError("");
    setPlayingTrackId(track.id);
    setActiveAudioUrl(source);
  }

  function resetTrackPlayback(track: EditableTrack) {
    const duration = durationForTrack(track);
    const audio = audioRef.current;

    if (playingTrackId === track.id && audio) {
      audio.currentTime = 0;
      savePlayback(track.id, 0, Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration);
      return;
    }

    savePlayback(track.id, 0, duration);
  }

  function seekTrack(track: EditableTrack, time: number) {
    const source = track.audioPreviewUrl || track.audioUrl;
    if (!source) return;

    const duration = durationForTrack(track);
    const seekTime = duration ? clamp(time / duration) * duration : Math.max(0, time);
    const audio = audioRef.current;

    if (playingTrackId === track.id && audio && activeAudioUrl === source) {
      audio.currentTime = seekTime;
      savePlayback(track.id, seekTime, duration);
      return;
    }

    saveActivePlayback();
    pendingSeekRef.current = { trackId: track.id, time: seekTime };
    setError("");
    setPlayingTrackId(track.id);
    setActiveAudioUrl(source);
  }

  function seekTrackFromPointer(event: MouseEvent<HTMLDivElement>, track: EditableTrack) {
    const duration = durationForTrack(track);
    if (!duration) {
      toggleTrackPlayback(track);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width);
    seekTrack(track, duration * ratio);
  }

  function seekTrackFromKeyboard(event: KeyboardEvent<HTMLDivElement>, track: EditableTrack) {
    const duration = durationForTrack(track);
    if (!duration) return;

    const currentTime = currentTimeForTrack(track);
    const step = event.shiftKey ? 10 : 5;
    let nextTime: number | null = null;

    if (event.key === "ArrowLeft") nextTime = currentTime - step;
    if (event.key === "ArrowRight") nextTime = currentTime + step;
    if (event.key === "Home") nextTime = 0;
    if (event.key === "End") nextTime = duration;

    if (nextTime === null) return;

    event.preventDefault();
    seekTrack(track, clamp(nextTime / duration) * duration);
  }

  function handleAudioMetadata() {
    const audio = audioRef.current;
    if (!audio || !playingTrackId) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const pendingSeek = pendingSeekRef.current;

    if (pendingSeek?.trackId === playingTrackId && duration > 0) {
      audio.currentTime = Math.min(Math.max(pendingSeek.time, 0), duration);
      pendingSeekRef.current = null;
    }

    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    savePlayback(playingTrackId, currentTime, duration);

    if (duration > 0) {
      updateTrack(playingTrackId, {
        duration: formatDuration(duration),
        durationSeconds: duration
      });
    }
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !playingTrackId) return;

    const track = tracks.find((item) => item.id === playingTrackId);
    const fallbackDuration = track ? durationForTrack(track) : 0;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

    savePlayback(playingTrackId, currentTime, duration);
  }

  function handleAudioEnded() {
    saveActivePlayback();
    setPlayingTrackId(null);
    setActiveAudioUrl("");
  }

  function moveTrack(id: string, direction: -1 | 1) {
    setTracks((current) => {
      const index = current.findIndex((track) => track.id === id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next.map((track, orderIndex) => ({ ...track, currentTrackOrder: orderIndex + 1 }));
    });
  }

  function beginAudioFileSelection() {
    setError("");
    setAudioUploadMessage(WAITING_FOR_AUDIO_FILES_MESSAGE);
  }

  function waitForPaint() {
    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  async function addAudioFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const accepted = files.filter(isAudioFile);

    if (!accepted.length) {
      setError("Drop audio files to populate the track list.");
      setAudioUploadMessage("");
      return;
    }

    setError("");

    try {
      const startIndex = tracks.length;
      const candidates: EditableTrack[] = [];

      for (const [index, file] of accepted.entries()) {
        setAudioUploadMessage(`Preparing audio file ${index + 1} of ${accepted.length}...`);
        await waitForPaint();

        const previewUrl = URL.createObjectURL(file);
        audioPreviewUrlsRef.current.push(previewUrl);
        const title = trackTitleFromFileName(file.name);
        const audioDetails = await readAudioDetails(file, previewUrl);

        candidates.push({
          id: `local-audio-${Date.now()}-${index}`,
          originalTrackNumber: startIndex + index + 1,
          currentTrackOrder: startIndex + index + 1,
          originalTrackTitle: title,
          finalTrackTitle: title,
          audioFileName: file.name,
          audioPreviewUrl: previewUrl,
          duration: audioDetails.duration,
          durationSeconds: audioDetails.durationSeconds,
          waveformPeaks: audioDetails.waveformPeaks
        });
      }

      setTracks((current) => [...current, ...candidates].map((track, index) => ({ ...track, currentTrackOrder: index + 1 })));
      setError(files.length === accepted.length ? "" : "Some files were skipped because they were not audio files.");
    } finally {
      setAudioUploadMessage("");
    }
  }

  function removeTrack(id: string) {
    setTracks((current) => {
      const removed = current.find((track) => track.id === id);
      if (removed?.audioPreviewUrl) {
        URL.revokeObjectURL(removed.audioPreviewUrl);
        audioPreviewUrlsRef.current = audioPreviewUrlsRef.current.filter((url) => url !== removed.audioPreviewUrl);
      }

      if (playingTrackId === id) {
        setPlayingTrackId(null);
        setActiveAudioUrl("");
      }

      setPlaybackByTrack((playback) => {
        const next = { ...playback };
        delete next[id];
        return next;
      });

      return current.filter((track) => track.id !== id).map((track, index) => ({ ...track, currentTrackOrder: index + 1 }));
    });
  }

  function addUploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const accepted = files.filter((file) => file.size <= MAX_ART_FILE_BYTES);
    const candidates = accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      artPreviewUrlsRef.current.push(previewUrl);

      return {
        file,
        caption: "",
        previewUrl
      };
    });

    setUploads((current) => [...current, ...candidates]);

    if (accepted.length !== files.length) {
      setError("Some files were larger than 4 MB and were skipped.");
    }
  }

  function removeUpload(index: number) {
    setUploads((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        artPreviewUrlsRef.current = artPreviewUrlsRef.current.filter((url) => url !== removed.previewUrl);
      }
      return next;
    });
  }

  async function uploadArtFiles() {
    if (!submissionSlug) throw new Error("Submission link is missing");

    let uploadedCount = 0;

    for (const upload of uploads) {
      const data = new FormData();
      data.append("file", upload.file);
      data.append("caption", upload.caption);

      const response = await fetch(`/api/producer/${encodeURIComponent(submissionSlug)}/art`, {
        method: "POST",
        body: data
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || `Unable to upload ${upload.file.name}`);
      }

      uploadedCount += 1;
    }

    return uploadedCount;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!finalAlbumTitle.trim()) {
      setError("Final album title is required.");
      return;
    }

    if (!submissionSlug) {
      setError("Submission link is missing.");
      return;
    }

    if (!tracks.length) {
      setError("At least one audio file is required.");
      return;
    }

    if (existingArtReferenceCount + uploads.length < 1) {
      setError("At least one album art inspiration image is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const uploadedCount = await uploadArtFiles();
      const response = await fetch(`/api/producer/${encodeURIComponent(submissionSlug)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalAlbumTitle: finalAlbumTitle.trim(),
          finalCatalog: finalCatalog.trim(),
          notes: submissionNotes.trim(),
          artReferenceCount: uploadedCount,
          tracks: tracks.map((track, index) => ({
            id: track.id,
            airtableId: track.airtableId,
            currentTrackOrder: index + 1,
            originalTrackTitle: track.originalTrackTitle,
            finalTrackTitle: track.finalTrackTitle.trim() || track.originalTrackTitle,
            audioFileName: track.audioFileName || "",
            audioUrl: track.audioUrl || "",
            duration: track.duration || "",
            producerNotes: track.producerNotes || ""
          }))
        })
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit album");
      setComplete(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit album");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="submissionShell centered">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  if (error && !album) {
    return (
      <main className="submissionShell centered">
        <div className="errorPanel">{error}</div>
      </main>
    );
  }

  if (!album) return null;

  if (complete) {
    return (
      <main className="submissionShell centered">
        <section className="completePanel">
          <span className="completeIcon">
            <Check size={28} />
          </span>
          <h1>Submitted</h1>
          <p>{album.workingAlbumTitle} is ready for review.</p>
          {backHref ? (
            <Link className="outlineButton" href={backHref}>
              Back
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="submissionShell">
      <form className="submissionPanel" onSubmit={handleSubmit} noValidate>
        <audio
          className="hiddenAudioPlayer"
          ref={audioRef}
          onDurationChange={handleAudioMetadata}
          onEnded={handleAudioEnded}
          onLoadedMetadata={handleAudioMetadata}
          onTimeUpdate={handleAudioTimeUpdate}
        />

        <header className="submissionHeader">
          <h1>Album Final Details</h1>
          {backHref ? (
            <Link className="textBackLink" href={backHref}>
              Back
            </Link>
          ) : null}
        </header>

        <div className="submissionAlbumMeta">
          <p className="workingTitleLine">
            <strong>Working Album Title:</strong> {album.workingAlbumTitle}
          </p>
          <p className="workingTitleLine">
            <strong>Catalog:</strong> {album.catalog || "Pending"}
          </p>
          {album.boxFolderUrl ? (
            <p className="workingTitleLine">
              <strong>Box Folder URL:</strong>{" "}
              <a className="inlineTextLink" href={album.boxFolderUrl} target="_blank" rel="noreferrer">
                Open Folder
              </a>
            </p>
          ) : null}
          {album.adminNotes?.trim() ? (
            <p className="workingTitleLine adminNotesLine">
              <strong>Notes:</strong>
              <span>{album.adminNotes}</span>
            </p>
          ) : null}
        </div>

        <section className="submissionSection plainSection">
          <label className="horizontalField">
            <span>Final Album Title:</span>
            <input
              value={finalAlbumTitle}
              onChange={(event) => setFinalAlbumTitle(event.target.value)}
              required
              aria-invalid={error === "Final album title is required."}
              autoFocus
            />
          </label>
          <label className="horizontalField">
            <span>Final Catalog (if changed):</span>
            <input value={finalCatalog} onChange={(event) => setFinalCatalog(event.target.value)} placeholder={album.catalog || ""} />
          </label>
        </section>

        {!albumHasStoredAudio ? (
          <section className="submissionSection plainSection">
            <h2 className="largeFieldLabel">Audio files:</h2>

            <label
              className={`dropZone audioDropZone ${audioUploadMessage ? "audioDropZoneLoading" : ""}`}
              aria-busy={Boolean(audioUploadMessage)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void addAudioFiles(Array.from(event.dataTransfer.files));
              }}
            >
              {audioUploadMessage ? (
                <div className="audioLoadingState" role="status" aria-live="polite">
                  <Loader2 className="spin" size={30} />
                  <span>{audioUploadMessage}</span>
                  <small>Large Box files may take a moment to become available.</small>
                </div>
              ) : (
                <>
                  <Upload size={30} />
                  <span>Drag and Drop Audio Files</span>
                </>
              )}
              <input
                type="file"
                accept={AUDIO_FILE_ACCEPT}
                multiple
                onClick={beginAudioFileSelection}
                onChange={(event) => {
                  const input = event.currentTarget;
                  void addAudioFiles(input.files || []).finally(() => {
                    input.value = "";
                  });
                }}
              />
            </label>
          </section>
        ) : null}

        <section className="submissionSection plainSection">
          <div className="sortableList">
            {tracks.map((track, index) => {
              const isPlaying = playingTrackId === track.id;
              const hasPlayableSource = Boolean(track.audioPreviewUrl || track.audioUrl);
              const isStoredTrack = Boolean(track.audioUrl && !track.audioPreviewUrl);
              const duration = durationForTrack(track);
              const currentTime = currentTimeForTrack(track);
              const playbackProgress = duration ? clamp(currentTime / duration) : 0;
              const bars = waveformBars(track.waveformPeaks);

              return (
                <article
                  className="waveTrack"
                  draggable
                  key={track.id}
                  onDragStart={() => setDraggingId(track.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingId) setTracks((current) => reorderTracks(current, draggingId, track.id));
                    setDraggingId(null);
                  }}
                >
                  <div className="trackHandle" aria-label="Drag track">
                    <GripVertical size={20} />
                  </div>

                  <div className="waveControls">
                    <button
                      className="wavePlay"
                      type="button"
                      onClick={() => toggleTrackPlayback(track)}
                      disabled={!hasPlayableSource}
                      aria-label={isPlaying ? `Pause ${track.originalTrackTitle}` : `Play ${track.originalTrackTitle}`}
                    >
                      {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                    <button
                      className="waveReset"
                      type="button"
                      onClick={() => resetTrackPlayback(track)}
                      disabled={!hasPlayableSource}
                      aria-label={`Reset ${track.originalTrackTitle} to beginning`}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>

                  <div className="waveTrackBody">
                    <div className="trackNameRow">
                      <span>{index + 1}.</span>
                      <label>
                        <span className="srOnly">Final track title</span>
                        <input
                          className="trackTitleInput"
                          value={track.finalTrackTitle}
                          onChange={(event) => updateTrack(track.id, { finalTrackTitle: event.target.value })}
                        />
                      </label>
                    </div>

                    <div
                      className={`waveform ${isPlaying ? "playing" : ""}`}
                      role="slider"
                      tabIndex={hasPlayableSource ? 0 : -1}
                      aria-disabled={!hasPlayableSource}
                      aria-label={`Seek in ${track.finalTrackTitle || track.originalTrackTitle}`}
                      aria-valuemin={0}
                      aria-valuemax={Math.round(duration)}
                      aria-valuenow={Math.round(currentTime)}
                      onClick={(event) => seekTrackFromPointer(event, track)}
                      onKeyDown={(event) => seekTrackFromKeyboard(event, track)}
                    >
                      {bars.map((height, barIndex) => (
                        <span
                          className={`waveBar ${(barIndex + 0.5) / bars.length <= playbackProgress ? "played" : ""}`}
                          style={{ height: `${height}px` }}
                          key={`${track.id}-${barIndex}`}
                        />
                      ))}
                    </div>

                    <div className="trackMetaLine">
                      <span>
                        {formatDuration(currentTime) || "0:00"} / {duration ? formatDuration(duration) : "0:00"}
                      </span>
                    </div>
                  </div>

                  <div className="trackButtons">
                    <button type="button" onClick={() => moveTrack(track.id, -1)} aria-label="Move track up">
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" onClick={() => moveTrack(track.id, 1)} aria-label="Move track down">
                      <ArrowDown size={16} />
                    </button>
                    {!isStoredTrack ? (
                      <button type="button" onClick={() => removeTrack(track.id)} aria-label={`Remove ${track.originalTrackTitle}`}>
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {!tracks.length ? <div className="emptyWorkflowState compact">No audio files added yet.</div> : null}
        </section>

        <section className="submissionSection plainSection">
          <h2 className="largeFieldLabel">Album art inspiration / references:</h2>

          <label
            className="dropZone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addUploadFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <ImagePlus size={30} />
            <span>Drag and Drop to Upload</span>
            <input type="file" accept="image/*" multiple onChange={(event) => addUploadFiles(event.target.files || [])} />
          </label>
          <p className="uploadLimitNote">*Images must be under 4 MB each.</p>

          {uploads.length ? (
            <div className="uploadGrid">
              {uploads.map((upload, index) => (
                <div className="uploadItem" key={upload.previewUrl}>
                  <img src={upload.previewUrl} alt="" />
                  <textarea
                    className="uploadNotes"
                    value={upload.caption}
                    placeholder="Notes"
                    rows={5}
                    onChange={(event) =>
                      setUploads((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, caption: event.target.value } : item))
                      )
                    }
                  />
                  <button type="button" onClick={() => removeUpload(index)} aria-label={`Remove ${upload.file.name}`}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {savedArtReferences.length ? (
            <div className="savedReferenceGrid">
              {savedArtReferences.map((reference, index) => {
                const referenceUrl = reference.attachmentUrl || reference.fileUrl || "";
                const referenceName = reference.fileName || `Reference ${index + 1}`;

                return (
                  <article className="savedReferenceItem" key={reference.airtableId || reference.id || `${referenceName}-${index}`}>
                    {reference.attachmentUrl ? (
                      <a className="savedReferencePreview" href={referenceUrl} target="_blank" rel="noreferrer">
                        <img src={reference.attachmentUrl} alt={referenceName} />
                      </a>
                    ) : referenceUrl ? (
                      <a className="savedReferencePreview filePreview" href={referenceUrl} target="_blank" rel="noreferrer">
                        <ImagePlus size={24} />
                        <span>Open File</span>
                      </a>
                    ) : (
                      <div className="savedReferencePreview filePreview">
                        <ImagePlus size={24} />
                        <span>No File URL</span>
                      </div>
                    )}

                    <div className="savedReferenceMeta">
                      <span>Reference {index + 1}</span>
                      <strong>{referenceName}</strong>
                      {reference.captionOrNotes ? <p>{reference.captionOrNotes}</p> : <p>No notes added.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="submissionSection plainSection submissionNotesSection">
          <label>
            <span className="largeFieldLabel">Notes (optional):</span>
            <textarea
              value={submissionNotes}
              rows={3}
              placeholder="Add any additional notes about the finalized album."
              onChange={(event) => setSubmissionNotes(event.target.value)}
            />
          </label>
        </section>

        {error ? (
          <div className="notice warning submitNotice" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="submissionFooter">
          <button className="outlineButton" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : null}
            Finish
          </button>
          {backHref ? (
            <Link className="outlineButton" href={backHref}>
              Back
            </Link>
          ) : (
            <button className="outlineButton" type="button" onClick={() => window.history.back()}>
              Back
            </button>
          )}
        </footer>

      </form>
    </main>
  );
}
