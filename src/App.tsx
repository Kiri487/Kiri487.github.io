import { lazy, Suspense, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import { SkinProvider, useSkin } from "./SkinContext";
import { EARS, FACES } from "./characters/kere/assistant/faces";

const SKINS = {
  kiri: lazy(() => import("./characters/kiri/KiriApp")),
  kuru: lazy(() => import("./characters/kuru/KuruApp")),
  kere: lazy(() => import("./characters/kere/KereApp")),
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

// Entries to the other skins in kiri's bottom-right corner: side by side on desktop,
// stacked on phones (Kere's cat face sits on the graffiti) so they cover less of the page width.
const MOBILE_QUERY = "(max-width: 640px)";

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

function switcherStyle(mobile: boolean): CSSProperties {
  return {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: 99999,
    display: "flex",
    flexDirection: mobile ? "column" : "row",
    alignItems: "center",
    gap: mobile ? "14px" : "20px",
  };
}

const switchButtonStyle: CSSProperties = {
  // Block + no line height, so each button is exactly its content's size and centers cleanly.
  display: "block",
  lineHeight: 0,
  cursor: "pointer",
  transition: "transform 0.3s",
  background: "none",
  border: "none",
  padding: 0,
};

const graffitiStyle: CSSProperties = { ...switchButtonStyle, width: "80px" };

// kere's stylesheet only loads inside that skin, so the face is styled inline here.
const kereFaceStyle: CSSProperties = {
  position: "relative",
  zIndex: 0,
  display: "block",
  fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
  fontSize: "0.95rem",
  lineHeight: 1.05,
  whiteSpace: "pre",
  textAlign: "left",
  color: "#000",
};

// White backing cut to the cat-head silhouette (same shape as in kere/style.css).
const kereBackingStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: -1,
  background: "#fff",
  clipPath: "polygon(0 100%, 0 50%, 1ch 50%, 2ch 0, 3ch 50%, 4ch 50%, 5ch 0, 6ch 50%, 7ch 50%, 7ch 100%)",
};

const growOnHover = {
  onMouseEnter: (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(1.05)";
  },
  onMouseLeave: (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(1)";
  },
};

function SkinSwitcher() {
  const { skin, setSkin } = useSkin();
  const mobile = useSyncExternalStore(subscribeMobile, isMobile);

  if (skin !== "kiri") return null;

  return (
    <div style={switcherStyle(mobile)}>
      <button
        type="button"
        style={switchButtonStyle}
        onClick={() => setSkin("kere")}
        aria-label="Switch to kere skin"
        {...growOnHover}
      >
        {/* Side by side, the face reads low next to the graffiti; nudge it up to center optically. */}
        <span style={{ ...kereFaceStyle, top: mobile ? 0 : "-4px" }} aria-hidden="true">
          <span style={kereBackingStyle} />
          {EARS}
          {"\n"}
          {FACES.normal}
        </span>
      </button>
      <button
        type="button"
        style={graffitiStyle}
        onClick={() => setSkin("kuru")}
        aria-label="Switch to kuru skin"
        {...growOnHover}
      >
        <img
          src="/kuru/textures/kiri487_graffiti.webp"
          alt="Switch to kuru"
          style={{ width: "100%", display: "block" }}
        />
      </button>
    </div>
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
