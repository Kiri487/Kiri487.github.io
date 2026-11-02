import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { readString, writeString } from "./shared/storage";

/** Add a new id here whenever you create another character under src/characters/. */
export type Skin = "kiri" | "kuru" | "kere" | "kara";

const SKIN_IDS: Skin[] = ["kiri", "kuru", "kere", "kara"];
const DEFAULT_SKIN: Skin = "kiri";
const STORAGE_KEY = "skin";
/** `?skin=kere` opens that skin directly, so any character can be shared as a link. */
const URL_PARAM = "skin";

function isSkin(value: string | null): value is Skin {
  return value !== null && SKIN_IDS.includes(value as Skin);
}

function readSkinFromUrl(): Skin | null {
  const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
  return isSkin(fromUrl) ? fromUrl : null;
}

/** The URL wins over the last visit, so a shared link always opens the intended skin. */
function readInitialSkin(): Skin {
  const fromUrl = readSkinFromUrl();
  if (fromUrl) return fromUrl;
  const saved = readString(STORAGE_KEY);
  return isSkin(saved) ? saved : DEFAULT_SKIN;
}

/** The current address with this skin in it. The default skin needs no parameter. */
function urlForSkin(skin: Skin): URL {
  const url = new URL(window.location.href);
  if (skin === DEFAULT_SKIN) url.searchParams.delete(URL_PARAM);
  else url.searchParams.set(URL_PARAM, skin);
  return url;
}

interface SkinContextValue {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextValue | undefined>(undefined);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<Skin>(readInitialSkin);

  useEffect(() => {
    writeString(STORAGE_KEY, skin);
    // Scopes each skin's CSS — every skin's stylesheet is written under
    // [data-skin="<id>"], so only the active skin's rules apply.
    document.documentElement.dataset.skin = skin;

    // Only differs on the first load, when a skin remembered from last time isn't in the address yet.
    // Replacing it means Back doesn't take an extra press to leave the site.
    const url = urlForSkin(skin);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [skin]);

  // Back and Forward. No parameter in a past address means the default skin, not the remembered one:
  // that entry was the default skin when it was visited. Kiri's router handles its own paths as usual.
  useEffect(() => {
    const syncWithUrl = () => setSkinState(readSkinFromUrl() ?? DEFAULT_SKIN);
    window.addEventListener("popstate", syncWithUrl);
    return () => window.removeEventListener("popstate", syncWithUrl);
  }, []);

  // Each switch is its own history entry, so Back returns to the skin before it.
  const setSkin = useCallback(
    (next: Skin) => {
      if (next === skin) return;
      window.history.pushState(null, "", urlForSkin(next));
      setSkinState(next);
    },
    [skin],
  );

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

// Hook is colocated with its provider, which is the conventional layout
// for a context file — exporting it alongside the component is intentional.
// eslint-disable-next-line react-refresh/only-export-components
export function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used within a SkinProvider");
  return ctx;
}
