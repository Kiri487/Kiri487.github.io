import { lazy, Suspense } from "react";
import { SkinProvider, useSkin } from "./SkinContext";

/** Register each skin here. Skins are lazy-loaded, so a visitor only
 *  downloads the code for the skin that is currently active. */
const SKINS = {
  kiri: lazy(() => import("./skins/kiri/KiriApp")),
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

function App() {
  return (
    <SkinProvider>
      <ActiveSkin />
    </SkinProvider>
  );
}

export default App;
