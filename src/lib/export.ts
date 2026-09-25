import type { Album } from "./types";
import { escapeCsvCell } from "./utils";

function finalTrackTitle(track: Album["tracks"][number]) {
  return track.finalTrackTitle || track.originalTrackTitle;
}

function previousTrackTitle(track: Album["tracks"][number]) {
  const finalTitle = finalTrackTitle(track).trim().toLowerCase();
  const originalTitle = track.originalTrackTitle.trim().toLowerCase();
  return finalTitle !== originalTitle ? track.originalTrackTitle : "";
}

function artReferenceUrl(reference: Album["artReferences"][number]) {
  return reference.attachmentUrl || reference.fileUrl || "";
}

export function albumToCsv(album: Album) {
  const sortedTracks = [...album.tracks].sort((a, b) => a.currentTrackOrder - b.currentTrackOrder);
  const sortedArtReferences = [...album.artReferences].sort((a, b) => (a.dateUploaded || "").localeCompare(b.dateUploaded || ""));
  const rows = [
    ["Album", ""],
    ["Working Album Title", album.workingAlbumTitle],
    ["Final Album Title", album.finalAlbumTitle || ""],
    ["Catalog", album.catalog || ""],
    ["Final Catalog (if changed)", album.finalCatalog || ""],
    ["Producer", album.producerName || ""],
    ["Producer Email", album.producerEmail || ""],
    ["Status", album.status],
    ["Date Submitted", album.dateSubmitted || ""],
    ["Box Folder URL", album.boxFolderUrl || ""],
    ...(album.submissionNotes?.trim() ? [["Notes", album.submissionNotes.trim()]] : []),
    [],
    ["Final Track List", ""],
    ["Track Order", "Final Track Title", "Previous Track Title", "Uploaded Audio File Name", "Duration"],
    ...sortedTracks.map((track) => [
      track.currentTrackOrder,
      finalTrackTitle(track),
      previousTrackTitle(track),
      track.audioFileName || "",
      track.duration || ""
    ]),
    [],
    ["Art Inspiration / References", ""],
    ["Art Reference Count", sortedArtReferences.length],
    ["Reference #", "File Name", "File URL", "Notes", "Date Uploaded"],
    ...sortedArtReferences.map((reference, index) => [
      index + 1,
      reference.fileName || "",
      artReferenceUrl(reference),
      reference.captionOrNotes || "",
      reference.dateUploaded || ""
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
