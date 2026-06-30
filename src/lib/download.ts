/**
 * Trigger a file download/open from a URL without being blocked by popup blockers.
 * Using <a> click works after `await` because it doesn't open a new window — the browser
 * treats it as a navigation/download initiated by the page, not as a popup.
 */
export function openDownloadUrl(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}
