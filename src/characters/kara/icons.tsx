import folder from "./assets/tango/folder.svg";
import multimediaPlayer from "./assets/tango/multimedia-player.svg";
import systemShutdown from "./assets/tango/system-shutdown.svg";
import textFile from "./assets/tango/text-x-generic.svg";
import terminal from "./assets/tango/utilities-terminal.svg";
import trash from "./assets/tango/user-trash.svg";
import refresh from "./assets/tango/view-refresh.svg";
import speaker from "./assets/tango/audio-volume-high.svg";
import dialogError from "./assets/tango/dialog-error.svg";
import imageMissing from "./assets/tango/image-missing.svg";
import imageFile from "./assets/tango/image-x-generic.svg";
import videoFile from "./assets/tango/video-x-generic.svg";
import linkFile from "./assets/tango/text-html.svg";
import goBack from "./assets/tango/go-previous.svg";
import goForward from "./assets/tango/go-next.svg";
import goUp from "./assets/tango/go-up.svg";
import search from "./assets/tango/system-search.svg";
import computer from "./assets/tango/computer.svg";
import groupChat from "./assets/tango/internet-group-chat.svg";

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

export function ComputerIcon({ size }: IconProps) {
  return <TangoIcon src={computer} size={size} />;
}

export function MessengerIcon({ size }: IconProps) {
  return <TangoIcon src={groupChat} size={size} />;
}

export function ErrorIcon({ size }: IconProps) {
  return <TangoIcon src={dialogError} size={size} />;
}

export function BrokenImageIcon({ size }: IconProps) {
  return <TangoIcon src={imageMissing} size={size} />;
}

export function ImageFileIcon({ size }: IconProps) {
  return <TangoIcon src={imageFile} size={size} />;
}

export function VideoFileIcon({ size }: IconProps) {
  return <TangoIcon src={videoFile} size={size} />;
}

export function LinkFileIcon({ size }: IconProps) {
  return <TangoIcon src={linkFile} size={size} />;
}

export function BackIcon({ size }: IconProps) {
  return <TangoIcon src={goBack} size={size} />;
}

export function ForwardIcon({ size }: IconProps) {
  return <TangoIcon src={goForward} size={size} />;
}

export function UpIcon({ size }: IconProps) {
  return <TangoIcon src={goUp} size={size} />;
}

export function SearchIcon({ size }: IconProps) {
  return <TangoIcon src={search} size={size} />;
}

/** Kara's mark on the start button. A cat head instead of a certain four-colour flag. */
export function CatMarkIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 2l4 4a7 7 0 0 1 6 0l4-4v10a7 7 0 0 1-14 0z" fill="#fff" />
    </svg>
  );
}
