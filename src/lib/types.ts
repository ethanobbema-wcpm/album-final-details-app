export type AlbumStatus =
  | "Assigned"
  | "Completed";

export type SubmissionStatus = "Draft" | "Submitted" | "Reviewed" | "Exported" | "Completed" | string;

export type Producer = {
  id: string;
  airtableId?: string;
  producerId?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  active?: boolean;
  defaultContactMethod?: string;
  notes?: string;
};

export type Track = {
  id: string;
  airtableId?: string;
  albumRecordId?: string;
  originalTrackNumber: number;
  currentTrackOrder: number;
  originalTrackTitle: string;
  finalTrackTitle: string;
  audioFileName?: string;
  audioUrl?: string;
  duration?: string;
  durationSeconds?: number;
  waveformPeaks?: number[];
  audioFileSize?: number;
  audioMimeType?: string;
  producerNotes?: string;
};

export type ArtReference = {
  id: string;
  airtableId?: string;
  albumRecordId?: string;
  uploadedByProducerId?: string;
  fileName?: string;
  attachmentUrl?: string;
  fileUrl?: string;
  captionOrNotes?: string;
  dateUploaded?: string;
};

export type Album = {
  id: string;
  airtableId?: string;
  workingAlbumTitle: string;
  finalAlbumTitle?: string;
  catalog?: string;
  finalCatalog?: string;
  producerId?: string;
  producerRecordId?: string;
  producerName?: string;
  producerEmail?: string;
  boxFolderUrl?: string;
  status: AlbumStatus;
  dateAssigned?: string;
  dateSubmitted?: string;
  privateSubmissionSlug: string;
  adminNotes?: string;
  submissionNotes?: string;
  downloadPackageUrl?: string;
  lastUpdated?: string;
  tracks: Track[];
  artReferences: ArtReference[];
  submissions: SubmissionSummary[];
};

export type SubmissionSummary = {
  id: string;
  airtableId?: string;
  albumRecordId?: string;
  producerRecordId?: string;
  submittedFinalAlbumTitle?: string;
  submittedFinalCatalog?: string;
  submittedNotes?: string;
  submittedTrackCount?: number;
  artReferenceCount?: number;
  status?: SubmissionStatus;
  submittedAt?: string;
  exportReady?: boolean;
  adminReviewNotes?: string;
  tracklistJson?: string;
};

export type AlbumListResponse = {
  albums: Album[];
  mode: "airtable" | "mock";
};

export type ProducerListResponse = {
  producers: Producer[];
  mode: "airtable" | "mock";
};

export type CreateAlbumInput = {
  workingAlbumTitle: string;
  catalog?: string;
  producerRecordId?: string;
  producerName?: string;
  boxFolderUrl?: string;
  adminNotes?: string;
  dateAssigned?: string;
  tracks?: Array<{
    originalTrackTitle: string;
    audioFileName?: string;
    audioUrl?: string;
    audioAttachmentUrl?: string;
    duration?: string;
    durationSeconds?: number;
    waveformPeaks?: number[];
    audioFileSize?: number;
    audioMimeType?: string;
  }>;
};

export type SubmitAlbumInput = {
  finalAlbumTitle: string;
  finalCatalog?: string;
  notes?: string;
  tracks: Array<{
    id: string;
    airtableId?: string;
    currentTrackOrder: number;
    originalTrackTitle?: string;
    finalTrackTitle: string;
    audioFileName?: string;
    audioUrl?: string;
    duration?: string;
    producerNotes?: string;
  }>;
  artReferenceCount: number;
};
