"use client";

import { Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { Producer, ProducerListResponse } from "@/lib/types";
import { todayIsoDate } from "@/lib/utils";

export function AddAlbumPage() {
  const router = useRouter();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [showProducerForm, setShowProducerForm] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [albumForm, setAlbumForm] = useState({
    workingAlbumTitle: "",
    catalog: "",
    producerRecordId: "",
    boxFolderUrl: "",
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

  async function handleCreateAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...albumForm,
          tracks: []
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create album");
      const id = data.album.airtableId || data.album.id;
      router.push(`/admin/albums/${encodeURIComponent(id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create album");
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
        </div>

        <div className="workflowButtonRow">
          <button className="outlineButton" type="submit" disabled={saving}>
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
