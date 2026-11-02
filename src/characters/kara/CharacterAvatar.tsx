import { PawIcon } from "./icons";

export type CharacterId = "kiri" | "kuru" | "koro" | "kere" | "kara";

/** The same paw for everyone until each character gets an avatar in their own style. Only the color differs. */
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
      <PawIcon size={Math.round(size * 0.55)} />
    </span>
  );
}

export default CharacterAvatar;
