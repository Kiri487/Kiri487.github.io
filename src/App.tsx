import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from "react";
import { SkinProvider, useSkin, type Skin } from "./SkinContext";
import SkinSwitcher from "./SkinSwitcher";

const SKINS = {
  kiri: lazy(() => import("./characters/kiri/KiriApp")),
  kuru: lazy(() => import("./characters/kuru/KuruApp")),
  kere: lazy(() => import("./characters/kere/KereApp")),
  kara: lazy(() => import("./characters/kara/KaraApp")),
} satisfies Record<Skin, LazyExoticComponent<ComponentType>>;

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
      <SkinSwitcher />
    </SkinProvider>
  );
}

export default App;
