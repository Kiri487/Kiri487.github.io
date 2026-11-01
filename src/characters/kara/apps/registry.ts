import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { BinIcon, FolderIcon, ImageFileIcon, NotepadIcon, RadioIcon, TerminalIcon, type IconProps } from "../icons";

export type AppId = "works" | "projects" | "radio" | "newFolder" | "asdf" | "recycleBin" | "imageViewer";

export interface AppDefinition {
  /** The real name, used by the start menu and, unless windowTitle says otherwise, the window. */
  title: string;
  windowTitle?: string;
  icon: ComponentType<IconProps>;
  /** Lazy, so opening the desktop never downloads an app's code. */
  component: LazyExoticComponent<ComponentType>;
  size: { width: number; height: number };
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

const Placeholder = lazy(() => import("./placeholder/PlaceholderApp"));
const WorksApp = lazy(() => import("./works/WorksApp"));
const ImageViewerApp = lazy(() => import("./imageViewer/ImageViewerApp"));

/** To add an app: give it a folder here, then an entry below (and optionally a desktop icon). */
export const APPS: Record<AppId, AppDefinition> = {
  radio: { title: "Kara Radio", icon: RadioIcon, component: Placeholder, size: { width: 480, height: 320 }, startMenu: "left" },
  asdf: { title: "asdf.txt - Notepad", icon: NotepadIcon, component: Placeholder, size: { width: 420, height: 300 }, startMenu: "left" },
  newFolder: { title: "新增資料夾 (3)", icon: FolderIcon, component: Placeholder, size: { width: 460, height: 300 }, startMenu: "left" },
  works: { title: "Works", windowTitle: "stuff i made", icon: FolderIcon, component: WorksApp, size: { width: 780, height: 520 }, startMenu: "right" },
  projects: { title: "Projects", icon: TerminalIcon, component: Placeholder, size: { width: 560, height: 380 }, startMenu: "right" },
  recycleBin: { title: "Recycle Bin", icon: BinIcon, component: Placeholder, size: { width: 460, height: 300 }, startMenu: "right" },
  imageViewer: { title: "Kara Picture Viewer", icon: ImageFileIcon, component: ImageViewerApp, size: { width: 640, height: 560 } },
};

/** Declaration order of APPS, which is also the start menu order. */
export const APP_IDS = Object.keys(APPS) as AppId[];

export const DESKTOP_ICONS: DesktopIconDefinition[] = [
  { label: "stuff i made", appId: "works", x: 3.3, y: 4.3 },
  { label: "Shortcut to Shortcut to radio", appId: "radio", x: 9.6, y: 13.7, shortcut: true },
  { label: "radio (final) (real)", appId: "radio", x: 28.5, y: 14.8 },
  { label: "things that compile", appId: "projects", x: 4.9, y: 33.7 },
  { label: "新增資料夾 (3)", appId: "newFolder", x: 13.5, y: 51 },
  { label: "asdf.txt", appId: "asdf", x: 4.1, y: 70.7 },
  { label: "Recycle Bin", appId: "recycleBin", x: 88.4, y: 69 },
];
