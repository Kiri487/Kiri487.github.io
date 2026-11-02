import KereAvatar from "../kere/avatar/KereAvatar";
import karaLeaf from "./assets/avatars/kara-leaf.webp";
import kuruAlley from "./assets/avatars/kuru.webp";
import { PawIcon } from "./icons";

export type CharacterId = "kiri" | "kuru" | "koro" | "kere" | "kara";

/** Keep in sync with the border of .kara-avatar in style.css. */
const BORDER_WIDTH = 2;
/** Kere's face is text, the same one as on kiri's skin switcher. This sets its font size against the avatar's. */
const KERE_FACE_SCALE = 0.2;

/**
 * A paw until a character gets art in their own style. `inset` art has its own empty space around it and
 * sits inside the frame; the rest is cropped at its edges, so it has to reach them.
 */
const AVATAR_ART: Partial<Record<CharacterId, { src: string; inset?: boolean }>> = {
  kiri: { src: "/kiri/KiriLogo.png", inset: true },
  kara: { src: karaLeaf },
  kuru: { src: kuruAlley },
};

const AVATAR_COLORS: Record<CharacterId, string> = {
  kiri: "#9da2b2",
  kere: "#fff",
  kuru: "#1f1f22",
  koro: "#a88bc9",
  kara: "#97a786",
};

function CharacterAvatar({ character, size }: { character: CharacterId; size: number }) {
  const art = AVATAR_ART[character];
  const artSize = art?.inset ? Math.round(size * 0.7) : size - BORDER_WIDTH * 2;

  return (
    <span
      className="kara-avatar"
      style={{ width: size, height: size, backgroundColor: AVATAR_COLORS[character] }}
    >
      {character === "kere" ? (
        <span className="kara-avatar__text" style={{ fontSize: size * KERE_FACE_SCALE }}>
          <KereAvatar />
        </span>
      ) : art ? (
        <img src={art.src} width={artSize} height={artSize} alt="" draggable={false} />
      ) : (
        <PawIcon size={Math.round(size * 0.55)} color="#2b2631" />
      )}
    </span>
  );
}

export default CharacterAvatar;
