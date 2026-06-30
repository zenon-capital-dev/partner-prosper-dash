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
