import folder from "./assets/tango/folder.svg";
import multimediaPlayer from "./assets/tango/multimedia-player.svg";
import systemShutdown from "./assets/tango/system-shutdown.svg";
import textFile from "./assets/tango/text-x-generic.svg";
import terminal from "./assets/tango/utilities-terminal.svg";
import trash from "./assets/tango/user-trash.svg";
import refresh from "./assets/tango/view-refresh.svg";
import speaker from "./assets/tango/audio-volume-high.svg";

/**
 * App and system icons come from the Tango icon theme 0.8.90 (public domain, see assets/tango/COPYING).
 * Each is a plain component, so replacing one with final art only touches this file.
 */
export interface IconProps {
  size: number;
}

function TangoIcon({ src, size }: IconProps & { src: string }) {
  // draggable={false}: the browser's image drag would otherwise interrupt double clicks and window dragging.
  return <img src={src} width={size} height={size} alt="" draggable={false} />;
}

export function FolderIcon({ size }: IconProps) {
  return <TangoIcon src={folder} size={size} />;
}

export function TerminalIcon({ size }: IconProps) {
  return <TangoIcon src={terminal} size={size} />;
}

export function RadioIcon({ size }: IconProps) {
  return <TangoIcon src={multimediaPlayer} size={size} />;
}

export function NotepadIcon({ size }: IconProps) {
  return <TangoIcon src={textFile} size={size} />;
}

export function BinIcon({ size }: IconProps) {
  return <TangoIcon src={trash} size={size} />;
}

export function SpeakerIcon({ size }: IconProps) {
  return <TangoIcon src={speaker} size={size} />;
}

export function PowerIcon({ size }: IconProps) {
  return <TangoIcon src={systemShutdown} size={size} />;
}

export function RestartIcon({ size }: IconProps) {
  return <TangoIcon src={refresh} size={size} />;
}

/** Kara's mark on the start button. A cat head instead of a certain four-colour flag. */
export function CatMarkIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 2l4 4a7 7 0 0 1 6 0l4-4v10a7 7 0 0 1-14 0z" fill="#fff" />
    </svg>
  );
}
