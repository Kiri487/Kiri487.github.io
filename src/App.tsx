import { lazy, Suspense, type CSSProperties } from "react";
import { SkinProvider, useSkin } from "./SkinContext";

/** Register each skin here. Skins are lazy-loaded, so a visitor only
 *  downloads the code for the skin that is currently active. */
const SKINS = {
  kiri: lazy(() => import("./skins/kiri/KiriApp")),
  kuru: lazy(() => import("./skins/kuru/KuruApp")),
} as const;

function ActiveSkin() {
  const { skin } = useSkin();
  const Skin = SKINS[skin];
  return (
    <Suspense fallback={null}>
      <Skin />
    </Suspense>
  );
}

/** Temporary dev control for hopping between skins. Inline-styled so it
 *  carries no global CSS; each skin can host its own switch UI later. */
const switcherStyle: CSSProperties = {
  position: "fixed",
  right: "16px",
  bottom: "16px",
  zIndex: 99999,
  padding: "8px 14px",
  fontFamily: "monospace",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#fff",
  background: "#000",
  border: "2px solid #fff",
  cursor: "pointer",
  boxShadow: "3px 3px 0 rgba(255, 255, 255, 0.35)",
};

function SkinSwitcher() {
  const { skin, setSkin } = useSkin();
  return (
    <button
      type="button"
      style={switcherStyle}
      onClick={() => setSkin(skin === "kiri" ? "kuru" : "kiri")}
    >
      SKIN ▸ {skin}
    </button>
  );
}

function App() {
  return (
    <SkinProvider>
      <ActiveSkin />
      <SkinSwitcher />
    </SkinProvider>
  );
}

export default App;
