import { createContext, useContext } from "react";
import type { AppId } from "../apps/registry";
import type { OsState } from "./windowManager";

export interface OpenAppOptions {
  title?: string;
  args?: unknown;
}

/** Stable for the life of the desktop, so components that only act on windows never re-render from state changes. */
export interface OsActions {
  /** An app has one window: opening it again brings that window back, with these options applied. */
  openApp: (appId: AppId, options?: OpenAppOptions) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  blurWindows: () => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  setWindowTitle: (id: string, title: string) => void;
  reset: () => void;
}

/** Return false to keep the window open when the visitor clicks its close button. */
export type CloseGuard = () => boolean;

/** What an app can do to its own window. Unusual behaviour belongs in the app, built on these. */
export interface WindowApi {
  windowId: string;
  /** What the opener passed to openApp. Each app knows the shape it expects. */
  args: unknown;
  isFocused: boolean;
  /** Minimized windows stay mounted, so an app with a render loop should pause while this is true. */
  isMinimized: boolean;
  /** Closes without asking the close guard. */
  close: () => void;
  minimize: () => void;
  setTitle: (title: string) => void;
  moveTo: (x: number, y: number) => void;
  openApp: OsActions["openApp"];
  setCloseGuard: (guard: CloseGuard | null) => void;
}

export const OsStateContext = createContext<OsState | null>(null);
export const OsActionsContext = createContext<OsActions | null>(null);
export const WindowContext = createContext<WindowApi | null>(null);

export function useOsState(): OsState {
  const state = useContext(OsStateContext);
  if (!state) throw new Error("useOsState must be used within an OsProvider");
  return state;
}

export function useOs(): OsActions {
  const actions = useContext(OsActionsContext);
  if (!actions) throw new Error("useOs must be used within an OsProvider");
  return actions;
}

/** For app components: controls the window the app is running in. */
export function useWindow(): WindowApi {
  const api = useContext(WindowContext);
  if (!api) throw new Error("useWindow must be used inside an app window");
  return api;
}
