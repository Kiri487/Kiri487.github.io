/** Leaves this computer for a real page, in a new tab so the desktop stays open. */
export function openExternal(url: string) {
  // mailto: hands off to the mail app, and would otherwise leave an empty tab behind.
  if (url.startsWith("mailto:")) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}
