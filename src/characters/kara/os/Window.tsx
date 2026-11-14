import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { APPS } from "../apps/registry";
import { DRAGGING_CLASS, useOs, WindowContext, type WindowApi } from "./context";
import { clamp } from "../../../shared/math";
import {
  clampPosition,
  readViewport,
  resizeRect,
  type ResizeDirection,
  type WindowRect,
  type WindowState,
} from "./windowManager";
import { useIsPhone } from "./useIsPhone";
import WindowErrorBoundary from "./WindowErrorBoundary";

interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
}

interface ResizeState {
  pointerId: number;
  direction: ResizeDirection;
  pointerX: number;
  pointerY: number;
  start: WindowRect;
  rect: WindowRect;
}

const RESIZE_DIRECTIONS: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function Window({ win, focused }: { win: WindowState; focused: boolean }) {
  const os = useOs();
  const rootRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const isPhone = useIsPhone();
  const { id, args, minimized } = win;
  // On a phone every window fills the screen, whatever it was doing before the screen got this small.
  const maximized = win.maximized || isPhone;
  const Icon = APPS[win.appId].icon;
  const App = APPS[win.appId].component;

  // Read when an app asks to resize, so moving the window doesn't hand every app a new api.
  const rectRef = useRef({ win, maximized });
  useEffect(() => {
    rectRef.current = { win, maximized };
  });

  const api = useMemo<WindowApi>(
    () => ({
      args,
      isMinimized: minimized,
      close: () => os.closeWindow(id),
      setTitle: (title) => os.setWindowTitle(id, title),
      resizeBy: (dWidth, dHeight) => {
        const { win: current, maximized: fillsScreen } = rectRef.current;
        if (fillsScreen) return;
        const viewport = readViewport();
        const { minSize } = APPS[current.appId];
        os.resizeWindow(id, {
          x: current.x,
          y: current.y,
          width: clamp(current.width + dWidth, minSize?.width ?? 0, viewport.width),
          height: clamp(current.height + dHeight, minSize?.height ?? 0, viewport.height),
        });
      },
      openApp: os.openApp,
    }),
    [id, args, minimized, os],
  );

  // The keyboard follows the window that comes to the front, whether it was just opened, brought back from the
  // taskbar or left on top when another closed. An app that already put the focus somewhere inside keeps it.
  useEffect(() => {
    const root = rootRef.current;
    if (!focused || minimized || !root || root.contains(document.activeElement)) return;
    root.focus({ preventScroll: true });
  }, [focused, minimized]);

  // Minimizing hides the window, which would drop the focus on the page itself. It goes to the window's taskbar
  // button instead, ready to bring it back; if another window comes to the front, the effect above takes it on.
  useLayoutEffect(() => {
    if (!minimized || !rootRef.current?.contains(document.activeElement)) return;
    document.querySelector<HTMLElement>(`.kara-taskbar__window[data-window-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }, [minimized, id]);

  // Closing hands the focus back to whatever opened the window, such as its desktop icon. If another window
  // comes to the front instead, the effect above then moves it there.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const opener = document.activeElement;
    return () => {
      if (!root?.contains(document.activeElement)) return;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // The same element each render, so moving or focusing the window doesn't re-render the app. It still hears `api` through context.
  const content = useMemo(() => <App />, [App]);

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

  // Resizing works the same way as dragging: the content follows through CSS until the release commits.
  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: win.x, y: win.y, width: win.width, height: win.height };
    resizeRef.current = {
      pointerId: event.pointerId,
      direction,
      pointerX: event.clientX,
      pointerY: event.clientY,
      start,
      rect: start,
    };
    rootRef.current?.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    // The dragged edge stops at the desktop's own edge, wherever on the handle the pointer took hold.
    const viewport = readViewport();
    const { start, direction, pointerX, pointerY } = resize;
    const edgeX = direction.includes("e") ? start.x + start.width : start.x;
    const edgeY = direction.includes("s") ? start.y + start.height : start.y;
    const resized = resizeRect(
      start,
      direction,
      clamp(event.clientX + edgeX - pointerX, 0, viewport.width) - edgeX,
      clamp(event.clientY + edgeY - pointerY, 0, viewport.height) - edgeY,
      APPS[win.appId].minSize,
    );
    // The same limit the release applies. If only the release did, a position that ends up unchanged
    // wouldn't be re-rendered, and the window would stay wherever this preview last put it.
    const rect = { ...resized, ...clampPosition(resized.x, resized.y, resized.width, viewport) };
    resize.rect = rect;

    const root = rootRef.current;
    if (!root) return;
    root.style.width = `${rect.width}px`;
    root.style.height = `${rect.height}px`;
    root.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
  };

  const handleResizePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    resizeRef.current = null;
    rootRef.current?.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    os.resizeWindow(id, resize.rect);
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
      tabIndex={-1}
      onPointerDownCapture={() => os.focusWindow(id)}
    >
      <div
        className="kara-window__title-bar"
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={handleTitlePointerEnd}
        onPointerCancel={handleTitlePointerEnd}
        onDoubleClick={(event) => {
          if (!isPhone && !(event.target as Element).closest("button")) os.toggleMaximizeWindow(id);
        }}
      >
        <Icon size={16} />
        <span className="kara-window__title">{win.title}</span>
        <button type="button" className="kara-window__button" aria-label="Minimize" onClick={() => os.minimizeWindow(id)}>
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
            <rect x="0" y="6" width="6" height="3" fill="currentColor" />
          </svg>
        </button>
        {!isPhone && (
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
        )}
        <button
          type="button"
          className="kara-window__button kara-window__button--close"
          aria-label="Close"
          onClick={() => os.closeWindow(id)}
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
              {content}
            </Suspense>
          </WindowErrorBoundary>
        </WindowContext.Provider>
        {/* Clicks inside an iframe never reach this document, so an unfocused window needs a cover to catch them. */}
        {!focused && <div className="kara-window__shield" />}
      </div>

      {!maximized &&
        RESIZE_DIRECTIONS.map((direction) => (
          <div
            key={direction}
            className={`kara-window__resize kara-window__resize--${direction}`}
            onPointerDown={(event) => handleResizePointerDown(event, direction)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerEnd}
            onPointerCancel={handleResizePointerEnd}
          />
        ))}
    </section>
  );
}

export default memo(Window);
