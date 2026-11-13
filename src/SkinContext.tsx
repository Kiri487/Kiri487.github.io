import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Add a new id here whenever you create another character under src/characters/,
 * and to SKIN_PAGES in vite.config.ts so its address is a real page.
 */
export type Skin = "kiri" | "kuru" | "kere" | "kara";

const SKIN_IDS: Skin[] = ["kiri", "kuru", "kere", "kara"];
/** Kiri is the hub and lives at "/", with her own pages below it. */
const HUB: Skin = "kiri";
/** Old links used `?skin=kere`. They still work and are rewritten to the skin's own address. */
const LEGACY_PARAM = "skin";

function isSkin(value: string | null | undefined): value is Skin {
  return value != null && SKIN_IDS.includes(value as Skin);
}

/** `/kere/` (or `/kere`) is Kere. Any other path, Kiri's pages and her 404 included, belongs to Kiri. */
function skinFromPath(pathname: string): Skin {
  const first = pathname.split("/")[1];
  return isSkin(first) ? first : HUB;
}

function readSkinFromUrl(): Skin {
  const legacy = new URLSearchParams(window.location.search).get(LEGACY_PARAM);
  return isSkin(legacy) ? legacy : skinFromPath(window.location.pathname);
}

/** The address a skin should show. Every skin but Kiri has one fixed address; Kiri's is the page given. */
function addressFor(skin: Skin, kiriPage: string): string {
  return skin === HUB ? kiriPage : `/${skin}/`;
}

/** Kiri's page in the current address: its path and query without the old `?skin=`, or "/" for `/kiri/`. */
function currentKiriPage(): string {
  const { pathname, search, hash } = window.location;
  if (pathname.split("/")[1] === HUB) return "/";
  const params = new URLSearchParams(search);
  params.delete(LEGACY_PARAM);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

/**
 * Tidies the address the site was opened at: `?skin=kara` becomes `/kara/`, `/kara` gets its slash and
 * `/kiri/` becomes "/". Call once before the first render, so Kiri's router never sees the untidy one.
 * Replaced, not pushed, so Back still leaves the site in one press.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function tidyInitialAddress() {
  const skin = readSkinFromUrl();
  const tidy = addressFor(skin, skin === HUB ? currentKiriPage() : "/");
  const { pathname, search, hash } = window.location;
  if (tidy !== `${pathname}${search}${hash}`) window.history.replaceState(window.history.state, "", tidy);
}

interface SkinContextValue {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextValue | undefined>(undefined);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<Skin>(readSkinFromUrl);
  /** Where to return in Kiri after visiting another skin. Lost on reload, when "/" is the answer. */
  const kiriReturn = useRef("/");

  useEffect(() => {
    // Scopes each skin's CSS — every skin's stylesheet is written under
    // [data-skin="<id>"], so only the active skin's rules apply.
    document.documentElement.dataset.skin = skin;
  }, [skin]);

  // Back and Forward between skins. Kiri's router handles moves between her own pages.
  useEffect(() => {
    const syncWithUrl = () => setSkinState(readSkinFromUrl());
    window.addEventListener("popstate", syncWithUrl);
    return () => window.removeEventListener("popstate", syncWithUrl);
  }, []);

  // Each switch is its own history entry, so Back returns to the skin before it.
  const setSkin = useCallback(
    (next: Skin) => {
      if (next === skin) return;
      if (skin === HUB) kiriReturn.current = currentKiriPage();
      window.history.pushState(null, "", addressFor(next, kiriReturn.current));
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
