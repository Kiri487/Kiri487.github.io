import type { AppId } from "../apps/registry";

/** Keep in sync with --kara-taskbar-height in ../style.css. */
const TASKBAR_HEIGHT = 32;
/** Keep in sync with --kara-title-bar-height in ../style.css. */
const TITLE_BAR_HEIGHT = 27;
/** How much of a window's title bar must stay on screen, so it can always be dragged back. */
const MIN_VISIBLE_WIDTH = 96;
const CASCADE_ORIGIN = 48;
const CASCADE_STEP = 28;
const CASCADE_LENGTH = 8;

export interface Viewport {
  width: number;
  height: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

export interface OsState {
  /**
   * Stays in opening order and is never re-sorted: stacking only changes `z`. Moving an iframe in the
   * DOM reloads it, so reordering here would restart a playing video whenever its window got focus.
   */
  windows: WindowState[];
  focusedId: string | null;
  topZ: number;
  nextWindowNumber: number;
}

export type OsAction =
  | { type: "open"; appId: AppId; title: string; size: WindowSize; viewport: Viewport }
  | { type: "close"; id: string }
  | { type: "focus"; id: string }
  | { type: "blur" }
  | { type: "minimize"; id: string }
  | { type: "toggleMaximize"; id: string }
  | { type: "move"; id: string; x: number; y: number; viewport: Viewport }
  | { type: "setTitle"; id: string; title: string }
  | { type: "fitViewport"; viewport: Viewport }
  | { type: "reset" };

export const INITIAL_OS_STATE: OsState = {
  windows: [],
  focusedId: null,
  topZ: 0,
  nextWindowNumber: 1,
};

/** The desktop area: everything above the taskbar. */
export function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight - TASKBAR_HEIGHT };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Windows may hang off the sides and bottom, but their title bar stays reachable. */
export function clampPosition(x: number, y: number, width: number, viewport: Viewport) {
  return {
    x: clamp(x, MIN_VISIBLE_WIDTH - width, viewport.width - MIN_VISIBLE_WIDTH),
    y: clamp(y, 0, viewport.height - TITLE_BAR_HEIGHT),
  };
}

function updateWindow(state: OsState, id: string, change: Partial<WindowState>): OsState {
  return { ...state, windows: state.windows.map((win) => (win.id === id ? { ...win, ...change } : win)) };
}

function raise(state: OsState, id: string, change: Partial<WindowState> = {}): OsState {
  const z = state.topZ + 1;
  return { ...updateWindow(state, id, { ...change, z }), topZ: z, focusedId: id };
}

function topVisibleWindowId(windows: WindowState[]): string | null {
  const top = windows.reduce<WindowState | null>(
    (best, win) => (!win.minimized && (best === null || win.z > best.z) ? win : best),
    null,
  );
  return top?.id ?? null;
}

export function osReducer(state: OsState, action: OsAction): OsState {
  switch (action.type) {
    case "open": {
      const existing = state.windows.find((win) => win.appId === action.appId);
      if (existing) return raise(state, existing.id, { minimized: false });

      const width = Math.min(action.size.width, action.viewport.width);
      const height = Math.min(action.size.height, action.viewport.height);
      const offset = CASCADE_ORIGIN + ((state.nextWindowNumber - 1) % CASCADE_LENGTH) * CASCADE_STEP;
      const z = state.topZ + 1;
      const id = `window-${state.nextWindowNumber}`;
      const win: WindowState = {
        id,
        appId: action.appId,
        title: action.title,
        x: clamp(offset, 0, action.viewport.width - width),
        y: clamp(offset, 0, action.viewport.height - height),
        width,
        height,
        z,
        minimized: false,
        maximized: false,
      };
      return {
        windows: [...state.windows, win],
        focusedId: id,
        topZ: z,
        nextWindowNumber: state.nextWindowNumber + 1,
      };
    }

    case "close": {
      const windows = state.windows.filter((win) => win.id !== action.id);
      const focusedId = state.focusedId === action.id ? topVisibleWindowId(windows) : state.focusedId;
      return { ...state, windows, focusedId };
    }

    case "focus": {
      const win = state.windows.find((candidate) => candidate.id === action.id);
      if (!win) return state;
      // Every click inside a window lands here, so the common case must not re-render anything.
      if (state.focusedId === win.id && win.z === state.topZ && !win.minimized) return state;
      return raise(state, win.id, { minimized: false });
    }

    case "blur":
      return state.focusedId === null ? state : { ...state, focusedId: null };

    case "minimize": {
      const next = updateWindow(state, action.id, { minimized: true });
      return {
        ...next,
        focusedId: state.focusedId === action.id ? topVisibleWindowId(next.windows) : state.focusedId,
      };
    }

    case "toggleMaximize": {
      const win = state.windows.find((candidate) => candidate.id === action.id);
      return win ? raise(state, win.id, { maximized: !win.maximized }) : state;
    }

    case "move": {
      const win = state.windows.find((candidate) => candidate.id === action.id);
      if (!win) return state;
      const { x, y } = clampPosition(action.x, action.y, win.width, action.viewport);
      return x === win.x && y === win.y ? state : updateWindow(state, win.id, { x, y });
    }

    case "setTitle":
      return updateWindow(state, action.id, { title: action.title });

    case "fitViewport": {
      let changed = false;
      const windows = state.windows.map((win) => {
        const { x, y } = clampPosition(win.x, win.y, win.width, action.viewport);
        if (x === win.x && y === win.y) return win;
        changed = true;
        return { ...win, x, y };
      });
      return changed ? { ...state, windows } : state;
    }

    case "reset":
      return INITIAL_OS_STATE;
  }
}
