/* Safe wrappers around localStorage / sessionStorage.
   Storage can be blocked outright (e.g. "block all cookies" makes even reading it throw), and saved values can be
   hand-edited or left over from an older format. Either way the site falls back to defaults instead of crashing;
   the only cost is that settings aren't remembered. */

type Area = "local" | "session";

function storage(area: Area): Storage {
  // Merely touching the property is what throws when storage is blocked, so this stays inside the callers' try.
  return area === "session" ? window.sessionStorage : window.localStorage;
}

export function readString(key: string, area: Area = "local"): string | null {
  try {
    return storage(area).getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string, area: Area = "local"): void {
  try {
    storage(area).setItem(key, value);
  } catch { /* storage unavailable or full */ }
}

/** Only "true" / "false" count; anything else gives `fallback`. Same format as `JSON.stringify(boolean)`. */
export function readBoolean(key: string, fallback: boolean): boolean {
  const raw = readString(key);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export function writeBoolean(key: string, value: boolean): void {
  writeString(key, String(value));
}

/** A finite number within [min, max], or `fallback`. */
export function readNumber(
  key: string,
  fallback: number,
  { min = -Infinity, max = Infinity }: { min?: number; max?: number } = {},
): number {
  const raw = readString(key);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}
