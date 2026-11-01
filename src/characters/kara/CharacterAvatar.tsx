import { CatMarkIcon } from "./icons";

export type CharacterId = "kiri" | "kuru" | "koro" | "kere" | "kara";

/** Same cat head for everyone for now. Each character only differs by color. */
const AVATAR_COLORS: Record<CharacterId, string> = {
  kiri: "#7f9bb3",
  kere: "#c4c6c3",
  kuru: "#1f1f22",
  koro: "#f3b6c8",
  kara: "#6c9a3c",
};

function CharacterAvatar({ character, size }: { character: CharacterId; size: number }) {
  return (
    <span
      className="kara-avatar"
      style={{ width: size, height: size, backgroundColor: AVATAR_COLORS[character] }}
    >
      <CatMarkIcon size={Math.round(size * 0.7)} />
    </span>
  );
}

export default CharacterAvatar;
