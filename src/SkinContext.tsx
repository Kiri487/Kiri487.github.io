import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readString, writeString } from "./shared/storage";

/** Add a new id here whenever you create another character under src/characters/. */
export type Skin = "kiri" | "kuru" | "kere";

const SKIN_IDS: Skin[] = ["kiri", "kuru", "kere"];
const DEFAULT_SKIN: Skin = "kiri";
const STORAGE_KEY = "skin";
/** `?skin=kere` opens that skin directly, so any character can be shared as a link. */
const URL_PARAM = "skin";

function isSkin(value: string | null): value is Skin {
  return value !== null && SKIN_IDS.includes(value as Skin);
}

/** The URL wins over the last visit, so a shared link always opens the intended skin. */
function readInitialSkin(): Skin {
  const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (isSkin(fromUrl)) return fromUrl;
  const saved = readString(STORAGE_KEY);
  return isSkin(saved) ? saved : DEFAULT_SKIN;
}

interface SkinContextValue {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextValue | undefined>(undefined);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkin] = useState<Skin>(readInitialSkin);

  useEffect(() => {
    writeString(STORAGE_KEY, skin);
    // Scopes each skin's CSS — every skin's stylesheet is written under
    // [data-skin="<id>"], so only the active skin's rules apply.
    document.documentElement.dataset.skin = skin;

    // Mirror the skin in the address bar, so copying it always gives a link to what's on screen.
    // The default skin needs no parameter. replaceState keeps the history (and kiri's router) untouched.
    const url = new URL(window.location.href);
    if (skin === DEFAULT_SKIN) url.searchParams.delete(URL_PARAM);
    else url.searchParams.set(URL_PARAM, skin);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [skin]);

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
