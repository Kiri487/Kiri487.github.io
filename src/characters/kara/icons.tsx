import { IoPaw } from "react-icons/io5";
import folder from "./assets/tango/folder.svg";
import multimediaPlayer from "./assets/tango/multimedia-player.svg";
import systemShutdown from "./assets/tango/system-shutdown.svg";
import textFile from "./assets/tango/text-x-generic.svg";
import terminal from "./assets/tango/utilities-terminal.svg";
import trash from "./assets/tango/user-trash.svg";
import trashFull from "./assets/tango/user-trash-full.svg";
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
import printer from "./assets/tango/printer.svg";
import dialogWarning from "./assets/tango/dialog-warning.svg";
import dialogInformation from "./assets/tango/dialog-information.svg";
import petSprite from "./assets/pet/kara-mute.webp";
import hamburger from "./assets/fluent-emoji/hamburger.svg";
import forkAndKnife from "./assets/fluent-emoji/fork-and-knife.svg";
import triangularFlag from "./assets/fluent-emoji/triangular-flag.svg";
import { usePetInBin } from "./os/petBin";

/**
 * App and system icons come from the Tango icon theme 0.8.90 (public domain, see assets/tango/COPYING). Burger
 * Sweeper's come from Microsoft's Fluent Emoji (MIT, see assets/fluent-emoji/LICENSE), since Tango has no burger.
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

/** Full while Kara is in it, everywhere the bin shows up. */
export function BinIcon({ size }: IconProps) {
  return <TangoIcon src={usePetInBin() ? trashFull : trash} size={size} />;
}

/** Kara as a file in the Recycle Bin. Not Tango: it's her. */
export function PetFileIcon({ size }: IconProps) {
  return <img src={petSprite} width={size} height={size} alt="" draggable={false} style={{ objectFit: "contain" }} />;
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

export function InfoIcon({ size }: IconProps) {
  return <TangoIcon src={dialogInformation} size={size} />;
}

export function WarningIcon({ size }: IconProps) {
  return <TangoIcon src={dialogWarning} size={size} />;
}

export function PrinterIcon({ size }: IconProps) {
  return <TangoIcon src={printer} size={size} />;
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

/** Kara's mark on the start button, a paw instead of a certain four-colour flag. Also the avatars' placeholder. */
export function PawIcon({ size, color = "#fff" }: IconProps & { color?: string }) {
  return <IoPaw size={size} color={color} aria-hidden="true" />;
}

export function BurgerIcon({ size }: IconProps) {
  return <TangoIcon src={hamburger} size={size} />;
}

/** Burger Sweeper's dig mode: poking a cell to see if it's a burger. */
export function ForkIcon({ size }: IconProps) {
  return <TangoIcon src={forkAndKnife} size={size} />;
}

/** Burger Sweeper's flag. */
export function FlagIcon({ size }: IconProps) {
  return <TangoIcon src={triangularFlag} size={size} />;
}
