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
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${baseUrl}/storage/v1/object/authenticated/${bucket}/${path}`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Falha ao baixar arquivo (${response.status})`);
    }
    saveBlobAsFile(await response.blob(), safeFilename);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Download demorou demais e foi cancelado. Tente novamente em alguns segundos.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
