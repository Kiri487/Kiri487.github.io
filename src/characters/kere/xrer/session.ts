import { readString, removeKey, writeString } from "../../../shared/storage";

/**
 * A review in progress, kept in sessionStorage: a refresh resumes it, closing the tab drops it (that's the review
 * abandoned, which is fine). Small on purpose: the round itself is rebuilt from its seed. Kept in its own file so
 * KereApp can check for one without loading XR's code.
 */
const KEY = "xrSession";

export function hasXrSession(): boolean {
  return readString(KEY, "session") !== null;
}

export function readXrSession(): unknown {
  const raw = readString(KEY, "session");
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeXrSession(snapshot: unknown): void {
  writeString(KEY, JSON.stringify(snapshot), "session");
}

export function clearXrSession(): void {
  removeKey(KEY, "session");
}
