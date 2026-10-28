import type { ComponentType } from "react";
import { useSkin, type Skin } from "./SkinContext";
import KereEntry from "./characters/kere/KereEntry";
import KuruEntry from "./characters/kuru/KuruEntry";
import "./SkinSwitcher.css";

/**
 * Ways out of kiri, the hub skin. Each character supplies its own badge; this only lays them out.
 * Add a new character's entry here.
 */
const ENTRIES: { skin: Skin; label: string; Badge: ComponentType }[] = [
  { skin: "kere", label: "Switch to kere skin", Badge: KereEntry },
  { skin: "kuru", label: "Switch to kuru skin", Badge: KuruEntry },
];

function SkinSwitcher() {
  const { skin, setSkin } = useSkin();

  if (skin !== "kiri") return null;

  return (
    <div className="skin-switcher">
      {ENTRIES.map(({ skin: target, label, Badge }) => (
        <button
          key={target}
          type="button"
          className="skin-switcher__entry"
          onClick={() => setSkin(target)}
          aria-label={label}
        >
          <Badge />
        </button>
      ))}
    </div>
  );
}

export default SkinSwitcher;
