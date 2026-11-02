import { createContext, useContext } from "react";
import type { AppId } from "../apps/registry";
import type { OsState, WindowRect } from "./windowManager";

/** Set on the desktop's root while a drag is under way, so iframes let the pointer through. */
export const DRAGGING_CLASS = "kara-os--dragging";

export interface OpenAppOptions {
  /** Leave out for the app's one window. Each different key gets a window of its own. */
  instanceKey?: string;
  title?: string;
  args?: unknown;
}

/** Stable for the life of the desktop, so components that only act on windows never re-render from state changes. */
export interface OsActions {
  /** Opening the same app and instanceKey again brings that window back, with these options applied. */
  openApp: (appId: AppId, options?: OpenAppOptions) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  blurWindows: () => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, rect: WindowRect) => void;
  setWindowTitle: (id: string, title: string) => void;
  reset: () => void;
}

/** What an app can do to its own window. Unusual behaviour belongs in the app, built on these. */
export interface WindowApi {
  /** What the opener passed to openApp. Each app knows the shape it expects. */
  args: unknown;
  /** Minimized windows stay mounted, so an app that plays or renders should pause while this is true. */
  isMinimized: boolean;
  close: () => void;
  setTitle: (title: string) => void;
  openApp: OsActions["openApp"];
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
