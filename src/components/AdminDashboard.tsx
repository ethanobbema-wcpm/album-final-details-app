"use client";

import { Clipboard, Download, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Album, AlbumListResponse } from "@/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";

function statusClass(status: string) {
  return `status-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

export function AdminDashboard() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [deletingAlbumId, setDeletingAlbumId] = useState("");

  async function loadData() {
    setLoadState("loading");
    setMessage("");

    try {
      const albumResponse = await fetch("/api/albums", { cache: "no-store" });
      if (!albumResponse.ok) throw new Error("Album request failed");

      const albumData = (await albumResponse.json()) as AlbumListResponse;
      setAlbums(albumData.albums);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "Unable to load albums");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  async function copyProducerLink(album: Album) {
    const link = `${appUrl.replace(/\/$/, "")}/submit/${album.privateSubmissionSlug}`;
    await navigator.clipboard.writeText(link);
    setMessage("Producer link copied.");
  }

  async function deleteSelectedAlbum(album: Album) {
    const id = album.airtableId || album.id;
    const confirmed = window.confirm(`Delete ${album.workingAlbumTitle}? This will also remove its tracks, submissions, and art references.`);
    if (!confirmed) return;

    setDeletingAlbumId(id);
    setMessage("");

    try {
      const response = await fetch(`/api/albums/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete album");

      setAlbums((current) => current.filter((item) => (item.airtableId || item.id) !== id));
      setMessage("Album deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete album");
    } finally {
      setDeletingAlbumId("");
    }
  }

  return (
    <main className="workflowShell">
      <header className="workflowHeader">
        <Image
          className="brandLogo"
          src="/images/wcpm_logo.png"
          alt="Warner Chappell Production Music"
          width={320}
          height={134}
          priority
        />
        <div className="workflowTools">
          <button className="roundIconButton" type="button" onClick={() => void loadData()} aria-label="Refresh albums">
            <RefreshCw size={19} />
          </button>
          <Link className="roundIconButton" href="/admin/add" aria-label="Add album">
            <Plus size={22} />
          </Link>
        </div>
      </header>

      <section className="albumListTitle">
        <h1>Album List</h1>
        {loadState === "loading" ? <Loader2 className="spin" size={24} /> : null}
      </section>

      {message ? <div className="notice">{message}</div> : null}
      {loadState === "error" ? <div className="notice warning">Could not load albums.</div> : null}

      <section className="albumList" aria-label="Album list">
        {albums.map((album) => {
          const id = album.airtableId || album.id;

          return (
            <article className="listAlbumCard" key={id}>
              <Link className="listAlbumMain" href={`/admin/albums/${encodeURIComponent(id)}`}>
                <div>
                  <p>
                    <strong>Album Title:</strong> {album.workingAlbumTitle}
                  </p>
                  <p>
                    <strong>Producer:</strong> {album.producerName || "Unassigned"}
                    <strong className="catalogLabel">Catalog:</strong> {album.catalog || "Pending"}
                  </p>
                  <p>
                    <strong>Assigned Date:</strong> {album.dateAssigned || "Not set"}
                  </p>
                </div>
                <span className={`workflowStatus ${statusClass(album.status)}`}>Status: {album.status}</span>
              </Link>
              <div className="listAlbumActions">
                <button type="button" onClick={() => void copyProducerLink(album)} aria-label={`Copy link for ${album.workingAlbumTitle}`}>
                  <Clipboard size={28} />
                </button>
                <a href={`/api/albums/${encodeURIComponent(id)}/export`} aria-label={`Download ${album.workingAlbumTitle} export`}>
                  <Download size={30} />
                </a>
                <button
                  type="button"
                  onClick={() => void deleteSelectedAlbum(album)}
                  disabled={deletingAlbumId === id}
                  aria-label={`Delete ${album.workingAlbumTitle}`}
                >
                  {deletingAlbumId === id ? <Loader2 className="spin" size={24} /> : <Trash2 size={30} />}
                </button>
              </div>
            </article>
          );
        })}

        {!albums.length && loadState !== "loading" ? (
          <div className="emptyWorkflowState">
            <h2>No albums yet</h2>
            <Link className="outlineButton" href="/admin/add">
              <Plus size={18} />
              Add Album
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
