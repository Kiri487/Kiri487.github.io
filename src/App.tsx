import { lazy, Suspense, type CSSProperties } from "react";
import { SkinProvider, useSkin } from "./SkinContext";

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

const graffitiStyle: CSSProperties = {
  position: "fixed",
  right: "20px",
  bottom: "20px",
  zIndex: 99999,
  width: "80px",
  cursor: "pointer",
  transition: "transform 0.3s",
  background: "none",
  border: "none",
  padding: 0,
};

function SkinSwitcher() {
  const { skin, setSkin } = useSkin();

  if (skin !== "kiri") return null;

  return (
    <button
      type="button"
      style={graffitiStyle}
      onClick={() => setSkin("kuru")}
      aria-label="Switch to kuru skin"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <img
        src="/kuru/textures/kiri487_graffiti.webp"
        alt="Switch to kuru"
        style={{ width: "100%", display: "block" }}
      />
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
