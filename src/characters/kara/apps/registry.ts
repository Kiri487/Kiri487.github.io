import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  BinIcon,
  ComputerIcon,
  FolderIcon,
  ImageFileIcon,
  MessengerIcon,
  NotepadIcon,
  RadioIcon,
  TerminalIcon,
  type IconProps,
} from "../icons";
import type { FolderArgs } from "./folder/types";

export type AppId =
  | "works"
  | "projects"
  | "about"
  | "messenger"
  | "chat"
  | "radio"
  | "newFolder"
  | "notepad"
  | "recycleBin"
  | "imageViewer";

export interface AppDefinition {
  /** The real name, used by the start menu and, unless windowTitle says otherwise, the window. */
  title: string;
  windowTitle?: string;
  /** The args when the opener passes none, such as from the desktop or the start menu. */
  defaultArgs?: object;
  icon: ComponentType<IconProps>;
  /** Lazy, so opening the desktop never downloads an app's code. */
  component: LazyExoticComponent<ComponentType>;
  size: { width: number; height: number };
  /** Leave out for the desktop's usual minimum. */
  minSize?: { width: number; height: number };
  /** Leave out for apps that only other apps open. */
  startMenu?: "left" | "right";
}

export interface DesktopIconDefinition {
  label: string;
  appId: AppId;
  /** Position inside the desktop area, in percent. Placed by hand on purpose: random would read as a bug. */
  x: number;
  y: number;
  shortcut?: boolean;
}

const RadioApp = lazy(() => import("./radio/RadioApp"));
const FolderApp = lazy(() => import("./folder/FolderApp"));
const ImageViewerApp = lazy(() => import("./imageViewer/ImageViewerApp"));
const ProjectsApp = lazy(() => import("./projects/ProjectsApp"));
const AboutApp = lazy(() => import("./about/AboutApp"));
const MessengerApp = lazy(() => import("./messenger/MessengerApp"));
const ChatApp = lazy(() => import("./chat/ChatApp"));
const NotepadApp = lazy(() => import("./notepad/NotepadApp"));

/** To add an app: give it a folder here, then an entry below (and optionally a desktop icon). */
export const APPS: Record<AppId, AppDefinition> = {
  radio: { title: "Kara Radio", icon: RadioIcon, component: RadioApp, size: { width: 520, height: 485 }, minSize: { width: 260, height: 450 }, startMenu: "left" },
  messenger: { title: "Kara Messenger", icon: MessengerIcon, component: MessengerApp, size: { width: 300, height: 440 }, startMenu: "left" },
  notepad: { title: "asdf.txt - Notepad", icon: NotepadIcon, component: NotepadApp, size: { width: 440, height: 480 }, startMenu: "left" },
  newFolder: { title: "新增資料夾 (3)", defaultArgs: { folderId: "newFolder" } satisfies FolderArgs, icon: FolderIcon, component: FolderApp, size: { width: 640, height: 440 }, startMenu: "left" },
  works: { title: "Works", windowTitle: "stuff i made", defaultArgs: { folderId: "works" } satisfies FolderArgs, icon: FolderIcon, component: FolderApp, size: { width: 780, height: 520 }, startMenu: "right" },
  projects: { title: "Projects", windowTitle: "Add or Remove Programs", icon: TerminalIcon, component: ProjectsApp, size: { width: 720, height: 520 }, startMenu: "right" },
  about: { title: "About", windowTitle: "System Properties", icon: ComputerIcon, component: AboutApp, size: { width: 520, height: 480 }, startMenu: "right" },
  recycleBin: { title: "Recycle Bin", defaultArgs: { folderId: "recycleBin" } satisfies FolderArgs, icon: BinIcon, component: FolderApp, size: { width: 640, height: 440 }, startMenu: "right" },
  chat: { title: "Conversation", icon: MessengerIcon, component: ChatApp, size: { width: 460, height: 400 } },
  imageViewer: { title: "Kara Picture Viewer", icon: ImageFileIcon, component: ImageViewerApp, size: { width: 640, height: 560 } },
};

/** Declaration order of APPS, which is also the start menu order. */
export const APP_IDS = Object.keys(APPS) as AppId[];

export const DESKTOP_ICONS: DesktopIconDefinition[] = [
  { label: "stuff i made", appId: "works", x: 3.3, y: 4.3 },
  { label: "Shortcut to Shortcut to radio", appId: "radio", x: 9.6, y: 13.7, shortcut: true },
  { label: "radio (final) (real)", appId: "radio", x: 28.5, y: 14.8 },
  { label: "things that compile", appId: "projects", x: 4.9, y: 33.7 },
  { label: "whose computer is this", appId: "about", x: 20.5, y: 36 },
  { label: "新增資料夾 (3)", appId: "newFolder", x: 13.5, y: 51 },
  { label: "kara messenger", appId: "messenger", x: 24, y: 63 },
  { label: "asdf.txt", appId: "notepad", x: 4.1, y: 70.7 },
  { label: "Recycle Bin", appId: "recycleBin", x: 88.4, y: 69 },
];
