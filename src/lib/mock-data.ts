import type { Album, Producer } from "./types";

export const mockProducers: Producer[] = [
  {
    id: "mock-prod-1",
    airtableId: "mock-prod-1",
    producerId: "PROD-0001",
    name: "Sean Gould",
    email: "sean@example.com",
    company: "Example Productions",
    active: true,
    defaultContactMethod: "Email",
    notes: "Sample producer record"
  },
  {
    id: "mock-prod-2",
    airtableId: "mock-prod-2",
    producerId: "PROD-0002",
    name: "Scott Reinwand",
    email: "scott@example.com",
    company: "Independent",
    active: true,
    defaultContactMethod: "Email",
    notes: "Sample producer record"
  }
];

export const mockAlbums: Album[] = [
  {
    id: "mock-alb-1",
    airtableId: "mock-alb-1",
    workingAlbumTitle: "Swinging Album",
    catalog: "VALO",
    producerRecordId: "mock-prod-1",
    producerName: "Sean Gould",
    producerEmail: "sean@example.com",
    boxFolderUrl: "https://box.example.com/s/example-folder-1",
    status: "Assigned",
    dateAssigned: "2026-09-10",
    privateSubmissionSlug: "swinging-album-sample",
    adminNotes: "Sample album record",
    lastUpdated: "2026-09-10",
    tracks: [
      {
        id: "mock-trk-1",
        airtableId: "mock-trk-1",
        albumRecordId: "mock-alb-1",
        originalTrackNumber: 1,
        currentTrackOrder: 1,
        originalTrackTitle: "Any More",
        finalTrackTitle: "",
        audioFileName: "01 Any More.wav",
        audioUrl: "https://box.example.com/file/any-more",
        duration: "1:39"
      },
      {
        id: "mock-trk-2",
        airtableId: "mock-trk-2",
        albumRecordId: "mock-alb-1",
        originalTrackNumber: 2,
        currentTrackOrder: 2,
        originalTrackTitle: "Exotic Plutonic",
        finalTrackTitle: "",
        audioFileName: "02 Exotic Plutonic.wav",
        audioUrl: "https://box.example.com/file/exotic-plutonic",
        duration: "1:50"
      },
      {
        id: "mock-trk-3",
        airtableId: "mock-trk-3",
        albumRecordId: "mock-alb-1",
        originalTrackNumber: 3,
        currentTrackOrder: 3,
        originalTrackTitle: "Hypnagogic Logic",
        finalTrackTitle: "",
        audioFileName: "03 Hypnagogic Logic.wav",
        audioUrl: "https://box.example.com/file/hypnagogic-logic",
        duration: "1:34"
      }
    ],
    artReferences: [],
    submissions: []
  },
  {
    id: "mock-alb-2",
    airtableId: "mock-alb-2",
    workingAlbumTitle: "Rocking Album",
    finalAlbumTitle: "Rocking Album",
    catalog: "NSPS",
    producerRecordId: "mock-prod-1",
    producerName: "Sean Gould",
    producerEmail: "sean@example.com",
    boxFolderUrl: "https://box.example.com/s/example-folder-2",
    status: "Completed",
    dateAssigned: "2026-09-01",
    dateSubmitted: "2026-09-08",
    privateSubmissionSlug: "rocking-album-sample",
    adminNotes: "Sample finished album record",
    downloadPackageUrl: "https://box.example.com/s/example-download",
    lastUpdated: "2026-09-08",
    tracks: [
      {
        id: "mock-trk-4",
        airtableId: "mock-trk-4",
        albumRecordId: "mock-alb-2",
        originalTrackNumber: 1,
        currentTrackOrder: 1,
        originalTrackTitle: "Jump Back",
        finalTrackTitle: "Jump Back",
        audioFileName: "01 Jump Back.wav",
        audioUrl: "https://box.example.com/file/jump-back",
        duration: "1:33"
      },
      {
        id: "mock-trk-5",
        airtableId: "mock-trk-5",
        albumRecordId: "mock-alb-2",
        originalTrackNumber: 2,
        currentTrackOrder: 2,
        originalTrackTitle: "Last Licks",
        finalTrackTitle: "Last Licks",
        audioFileName: "02 Last Licks.wav",
        audioUrl: "https://box.example.com/file/last-licks",
        duration: "1:45"
      }
    ],
    artReferences: [
      {
        id: "mock-art-1",
        airtableId: "mock-art-1",
        albumRecordId: "mock-alb-2",
        uploadedByProducerId: "mock-prod-1",
        fileName: "moodboard-reference.jpg",
        fileUrl: "https://box.example.com/file/moodboard-reference",
        captionOrNotes: "Sample art inspiration reference",
        dateUploaded: "2026-09-08"
      }
    ],
    submissions: [
      {
        id: "mock-sub-1",
        airtableId: "mock-sub-1",
        albumRecordId: "mock-alb-2",
        producerRecordId: "mock-prod-1",
        submittedFinalAlbumTitle: "Rocking Album",
        submittedTrackCount: 2,
        artReferenceCount: 1,
        status: "Completed",
        submittedAt: "2026-09-08 14:30",
        exportReady: true,
        adminReviewNotes: "Sample submitted album",
        tracklistJson: JSON.stringify([
          { order: 1, title: "Jump Back" },
          { order: 2, title: "Last Licks" }
        ])
      }
    ]
  }
];
