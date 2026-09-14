export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function isoDateTimeMinute() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "album"}-${suffix}`;
}

export function parseTrackTextarea(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const stripped = line.replace(/^\d+[\s.)_-]+/, "").trim();
      return {
        originalTrackTitle: stripped || line,
        audioFileName: line
      };
    });
}

export function normalizeStatus(status: string | undefined) {
  return status === "Completed" ? "Completed" : "Assigned";
}

export function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
