import { supabase } from "@/integrations/supabase/client";

/**
 * Trigger a file download/open from a URL without being blocked by popup blockers.
 * When a filename is provided we treat it as a download (no _blank → browser navigates
 * in-tab and the Content-Disposition: attachment from Supabase's ?download= param
 * forces the save dialog, so no tab is actually opened).
 */
export function openDownloadUrl(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) {
    a.download = filename;
  } else {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}

export function saveBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "arquivo";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 250);
}

export async function downloadStorageFile(bucket: string, path: string, filename?: string) {
  const safeFilename = filename || path.split("/").pop() || "arquivo";
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error || new Error("Arquivo não encontrado");
  saveBlobAsFile(data, safeFilename);
}
