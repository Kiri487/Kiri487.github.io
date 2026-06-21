import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Add a new id here whenever you create another skin under src/skins/. */
export type Skin = "kiri" | "kuru";

const SKIN_IDS: Skin[] = ["kiri", "kuru"];
const DEFAULT_SKIN: Skin = "kiri";
const STORAGE_KEY = "skin";

interface SkinContextValue {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextValue | undefined>(undefined);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkin] = useState<Skin>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && SKIN_IDS.includes(saved as Skin) ? (saved as Skin) : DEFAULT_SKIN;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, skin);
    // Scopes each skin's CSS — every skin's stylesheet is written under
    // [data-skin="<id>"], so only the active skin's rules apply.
    document.documentElement.dataset.skin = skin;
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
