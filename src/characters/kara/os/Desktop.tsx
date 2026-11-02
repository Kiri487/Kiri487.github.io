import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useSkin } from "../../../SkinContext";
import { APPS, DESKTOP_ICONS } from "../apps/registry";
import { DRAGGING_CLASS, useOs } from "./context";
import { openGesture } from "./openGesture";

/** How far the pointer must travel before a press on the desktop counts as a drag and not a click. */
const DRAG_THRESHOLD = 3;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface SelectionDrag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Measured once when the drag starts, since icons can't move during one. */
  icons: { label: string; box: Box }[];
  bounds: DOMRect;
  started: boolean;
}

const NOTHING_SELECTED: ReadonlySet<string> = new Set();

function boxesTouch(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function ShortcutArrow() {
  return (
    <svg className="kara-icon__shortcut" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect width="14" height="14" fill="#fff" />
      <path d="M3 11l6-6M5 4h5v5" fill="none" stroke="#1d5fb5" strokeWidth="2" />
    </svg>
  );
}

function Desktop() {
  const os = useOs();
  const { setSkin } = useSkin();
  const [selectedLabels, setSelectedLabels] = useState(NOTHING_SELECTED);
  const [selectionBox, setSelectionBox] = useState<Box | null>(null);
  const dragRef = useRef<SelectionDrag | null>(null);

  const handleDesktopPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    os.blurWindows();
    if (event.target !== event.currentTarget) return;

    setSelectedLabels(NOTHING_SELECTED);
    // On touch, the same gesture will belong to the phone layout.
    if (event.button !== 0 || event.pointerType === "touch") return;

    const desktop = event.currentTarget;
    const bounds = desktop.getBoundingClientRect();
    desktop.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      bounds,
      started: false,
      icons: Array.from(desktop.querySelectorAll<HTMLElement>(".kara-icon")).map((icon) => {
        const { left, top, right, bottom } = icon.getBoundingClientRect();
        return { label: icon.dataset.label ?? "", box: { left, top, right, bottom } };
      }),
    };
  };

  const handleDesktopPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.started) {
      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (moved < DRAG_THRESHOLD) return;
      drag.started = true;
      // Over a video, an iframe would otherwise swallow the pointer.
      event.currentTarget.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
    }

    const { bounds } = drag;
    const x = Math.min(Math.max(event.clientX, bounds.left), bounds.right);
    const y = Math.min(Math.max(event.clientY, bounds.top), bounds.bottom);
    const box = {
      left: Math.min(drag.startX, x),
      top: Math.min(drag.startY, y),
      right: Math.max(drag.startX, x),
      bottom: Math.max(drag.startY, y),
    };

    setSelectionBox(box);
    setSelectedLabels(new Set(drag.icons.filter((icon) => boxesTouch(box, icon.box)).map((icon) => icon.label)));
  };

  const handleDesktopPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    setSelectionBox(null);
  };

  return (
    <div
      className="kara-desktop"
      onPointerDown={handleDesktopPointerDown}
      onPointerMove={handleDesktopPointerMove}
      onPointerUp={handleDesktopPointerEnd}
      onPointerCancel={handleDesktopPointerEnd}
    >
      {DESKTOP_ICONS.map((item) => {
        const { label, x, y, shortcut } = item;
        const Icon = "skin" in item ? item.icon : APPS[item.appId].icon;
        return (
          <button
            key={label}
            type="button"
            data-label={label}
            className={`kara-icon${selectedLabels.has(label) ? " kara-icon--selected" : ""}`}
            style={{
              // Percentages keep the mess on screen at any size; min() stops the last column running off the edge.
              left: `min(${x}%, calc(100% - var(--kara-icon-width)))`,
              top: `${y}%`,
            }}
            onPointerDown={() => setSelectedLabels(new Set([label]))}
            {...openGesture(() => ("skin" in item ? setSkin(item.skin) : os.openApp(item.appId)))}
          >
            <span className="kara-icon__image">
              <Icon size={40} />
              {shortcut && <ShortcutArrow />}
            </span>
            <span className="kara-icon__label">{label}</span>
          </button>
        );
      })}
      {selectionBox && (
        <div
          className="kara-desktop__selection"
          style={{
            // The desktop starts at the top left of the viewport, so these coordinates already match.
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.right - selectionBox.left,
            height: selectionBox.bottom - selectionBox.top,
          }}
        />
      )}
    </div>
  );
}

export default Desktop;
