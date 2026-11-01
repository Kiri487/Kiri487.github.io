import { memo, Suspense, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { APPS } from "../apps/registry";
import { useOs, WindowContext, type CloseGuard, type WindowApi } from "./context";
import { clampPosition, readViewport, type WindowState } from "./windowManager";
import WindowErrorBoundary from "./WindowErrorBoundary";

interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
}

const DRAGGING_CLASS = "kara-os--dragging";

function Window({ win, focused }: { win: WindowState; focused: boolean }) {
  const os = useOs();
  const rootRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const closeGuardRef = useRef<CloseGuard | null>(null);

  const { id, args, minimized, maximized } = win;
  const Icon = APPS[win.appId].icon;
  const App = APPS[win.appId].component;

  const api = useMemo<WindowApi>(
    () => ({
      windowId: id,
      args,
      isFocused: focused,
      isMinimized: minimized,
      close: () => os.closeWindow(id),
      minimize: () => os.minimizeWindow(id),
      setTitle: (title) => os.setWindowTitle(id, title),
      moveTo: (x, y) => os.moveWindow(id, x, y),
      openApp: os.openApp,
      setCloseGuard: (guard) => {
        closeGuardRef.current = guard;
      },
    }),
    [id, args, focused, minimized, os],
  );

  const handleClose = () => {
    if (closeGuardRef.current?.() === false) return;
    os.closeWindow(id);
  };

  // Dragging writes the transform directly and only commits on release, so neither the desktop
  // nor a video or 3D scene inside the window re-renders on every pointer move.
  const handleTitlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || maximized) return;
    if ((event.target as Element).closest("button")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - win.x,
      offsetY: event.clientY - win.y,
      x: win.x,
      y: win.y,
    };
    // An iframe would otherwise swallow pointer events as the cursor passes over it.
    rootRef.current?.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
  };

  const handleTitlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const { x, y } = clampPosition(
      event.clientX - drag.offsetX,
      event.clientY - drag.offsetY,
      win.width,
      readViewport(),
    );
    drag.x = x;
    drag.y = y;
    if (rootRef.current) rootRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const handleTitlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    rootRef.current?.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    os.moveWindow(id, drag.x, drag.y);
  };

  const positionStyle = maximized
    ? { zIndex: win.z, width: "100%", height: "100%" }
    : {
        zIndex: win.z,
        width: win.width,
        height: win.height,
        transform: `translate3d(${win.x}px, ${win.y}px, 0)`,
      };

  const classNames = ["kara-window"];
  if (focused) classNames.push("kara-window--focused");
  if (minimized) classNames.push("kara-window--minimized");
  if (maximized) classNames.push("kara-window--maximized");

  return (
    <section
      ref={rootRef}
      className={classNames.join(" ")}
      style={positionStyle}
      aria-label={win.title}
      onPointerDownCapture={() => os.focusWindow(id)}
    >
      <div
        className="kara-window__title-bar"
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={handleTitlePointerEnd}
        onPointerCancel={handleTitlePointerEnd}
        onDoubleClick={(event) => {
          if (!(event.target as Element).closest("button")) os.toggleMaximizeWindow(id);
        }}
      >
        <Icon size={16} />
        <span className="kara-window__title">{win.title}</span>
        <button type="button" className="kara-window__button" aria-label="Minimize" onClick={() => os.minimizeWindow(id)}>
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
            <rect x="0" y="6" width="6" height="3" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="kara-window__button"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => os.toggleMaximizeWindow(id)}
        >
          {maximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
              <path d="M3 3V1h7v6H8M1 4h7v6H1z" fill="none" stroke="currentColor" />
              <path d="M3 1h7M1 4h7" stroke="currentColor" strokeWidth="2" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
              <rect x="0.5" y="0.5" width="10" height="10" fill="none" stroke="currentColor" />
              <rect x="0" y="0" width="11" height="3" fill="currentColor" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="kara-window__button kara-window__button--close"
          aria-label="Close"
          onClick={handleClose}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>

      <div className="kara-window__body">
        <WindowContext.Provider value={api}>
          <WindowErrorBoundary>
            <Suspense fallback={<p className="kara-window__loading">Loading...</p>}>
              <App />
            </Suspense>
          </WindowErrorBoundary>
        </WindowContext.Provider>
        {/* Clicks inside an iframe never reach this document, so an unfocused window needs a cover to catch them. */}
        {!focused && <div className="kara-window__shield" />}
      </div>
    </section>
  );
}

export default memo(Window);
