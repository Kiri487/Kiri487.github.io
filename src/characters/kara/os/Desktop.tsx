import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSkin } from "../../../SkinContext";
import MessageBox from "../apps/common/MessageBox";
import { APPS, DESKTOP_ICONS, type DesktopIconDefinition } from "../apps/registry";
import ContextMenu, { type ContextMenuItem } from "./ContextMenu";
import { DRAGGING_CLASS, useOs } from "./context";
import { isTouchPointer, openGesture } from "./openGesture";
import { usePetInBin } from "./petBin";
import { useIsPhone } from "./useIsPhone";

/** How far the pointer must travel before a press on the desktop counts as a drag and not a click. */
const DRAG_THRESHOLD = 3;
/** Matches the trip into the bin in style.css. */
const TO_BIN_MS = 300;
/** Matches the pop back out in style.css. */
const BACK_FROM_BIN_MS = 250;
/** How long a deleted icon stays gone. */
const BLINK_MS = 300;
/** Matches the slide back in style.css, for icons let go of over a window. */
const SNAP_BACK_MS = 200;
/** Long enough to notice the icons were gone, and nothing else. */
const REFRESH_MS = 150;

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

interface IconDrag {
  pointerId: number;
  startX: number;
  startY: number;
  /** The icon pressed. A click without a drag leaves only it selected. */
  label: string;
  labels: string[];
  /** Everything below is measured when the drag starts. */
  started: boolean;
  elements: HTMLElement[];
  boxes: Record<string, Box>;
  bounds: DOMRect;
  limits: Box;
  /** Null when the bin is one of the icons being carried. */
  bin: HTMLElement | null;
  overBin: boolean;
  /** Windows don't take desktop icons, so letting go over one sends them back. */
  overWindow: boolean;
  dx: number;
  dy: number;
}

/** In percent of the desktop, the same as the registry's. */
type Positions = Record<string, { x: number; y: number }>;

/** Icons on their way into the bin, and back out of it. */
interface Flight {
  labels: ReadonlySet<string>;
  stage: "going" | "back";
  /** From each icon's own spot to the middle of the bin. */
  deltas: Record<string, { dx: number; dy: number }>;
}

const NOTHING_SELECTED: ReadonlySet<string> = new Set();
const DEFAULT_POSITIONS: Positions = Object.fromEntries(DESKTOP_ICONS.map(({ label, x, y }) => [label, { x, y }]));

function boxesTouch(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function boxOf(element: Element): Box {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
}

/** The same spots handed out again in another order, so it's still the mess Kiri placed, just differently wrong. */
function shufflePositions(current: Positions): Positions {
  const labels = Object.keys(current);
  const spots = labels.map((label) => current[label]);
  do {
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
  } while (spots.every((spot, index) => spot === current[labels[index]]));
  return Object.fromEntries(labels.map((label, index) => [label, spots[index]]));
}

function iconLabel(element: Element | null): string | undefined {
  return element?.closest<HTMLElement>(".kara-icon")?.dataset.label;
}

/** Too narrow a screen for the mess, so the icons get a grid, each a little off its spot. Fixed, so they never shuffle around. */
const PHONE_OFFSETS = [
  { x: 4, y: -5 },
  { x: -6, y: 7 },
  { x: 7, y: 2 },
  { x: -4, y: -7 },
  { x: 2, y: 8 },
  { x: 8, y: -4 },
  { x: -7, y: 4 },
];

function phoneIconStyle(index: number) {
  const { x, y } = PHONE_OFFSETS[index % PHONE_OFFSETS.length];
  return { translate: `${x}px ${y}px` };
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
  const isPhone = useIsPhone();
  const petInBin = usePetInBin();
  const desktopRef = useRef<HTMLDivElement>(null);
  const [selectedLabels, setSelectedLabels] = useState(NOTHING_SELECTED);
  const [selectionBox, setSelectionBox] = useState<Box | null>(null);
  const dragRef = useRef<SelectionDrag | null>(null);
  // Not remembered: a reload puts everything back where it was.
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const iconDragRef = useRef<IconDrag | null>(null);
  const [dragOffset, setDragOffset] = useState<{ labels: ReadonlySet<string>; dx: number; dy: number } | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [snappingBack, setSnappingBack] = useState<ReadonlySet<string> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [message, setMessage] = useState<{ title: string; text: string; kind?: "info" } | null>(null);
  const [blinking, setBlinking] = useState<ReadonlySet<string> | null>(null);
  const timersRef = useRef<number[]>([]);
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const later = (callback: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(callback, ms));
  };

  const say = (title: string, text: string, kind?: "info") => setMessage({ title, text, kind });

  const cameBack = (count: number) => say("Recycle Bin", count > 1 ? "They all came back. Together." : "It came back.");

  /** Deleting from the menu: gone for a moment, then back where they were. */
  const blinkAway = (labels: string[]) => {
    if (labels.length === 0) return;
    const gone = new Set(labels);
    setBlinking(gone);
    later(() => {
      setBlinking((current) => (current === gone ? null : current));
      cameBack(gone.size);
    }, BLINK_MS);
  };

  const openIcon = (item: DesktopIconDefinition) => ("skin" in item ? setSkin(item.skin) : os.openApp(item.appId));

  const iconElement = (label: string) =>
    desktopRef.current?.querySelector<HTMLElement>(`.kara-icon[data-label="${CSS.escape(label)}"]`) ?? null;

  /** Into the bin they go, and straight back out. Boxes are where each icon sat when the drag started. */
  const throwAway = (labels: string[], boxes: Record<string, Box>) => {
    const bin = desktopRef.current?.querySelector('.kara-icon[data-app-id="recycleBin"]');
    if (!bin || labels.length === 0) return;
    const target = boxOf(bin);
    const centerX = (target.left + target.right) / 2;
    const centerY = (target.top + target.bottom) / 2;
    const deltas: Flight["deltas"] = {};
    for (const label of labels) {
      const box = boxes[label];
      if (!box) continue;
      deltas[label] = { dx: centerX - (box.left + box.right) / 2, dy: centerY - (box.top + box.bottom) / 2 };
    }
    const flying = new Set(labels);
    setFlight({ labels: flying, stage: "going", deltas });
    later(() => {
      setFlight({ labels: flying, stage: "back", deltas });
      cameBack(flying.size);
      later(() => setFlight(null), BACK_FROM_BIN_MS);
    }, TO_BIN_MS);
  };

  const refresh = () => {
    setRefreshing(true);
    later(() => setRefreshing(false), REFRESH_MS);
  };

  const desktopMenu = (): ContextMenuItem[] => [
    {
      label: "Arrange Icons By",
      submenu: [
        // Kara insists this is alphabetical.
        { label: "Name", onSelect: () => setPositions(DEFAULT_POSITIONS) },
        { label: "Vibes", onSelect: () => setPositions(shufflePositions) },
        { label: "Smell", onSelect: () => say("Arrange Icons By", "This computer can't smell. Ask Kara.") },
      ],
    },
    { label: "Refresh", onSelect: refresh },
    "separator",
    {
      label: "New",
      submenu: [
        { label: "Folder", onSelect: () => say("New", "That would be (4). Not yet.") },
        { label: "Chicken Burger", onSelect: () => say("New", "The Printer is working on it.") },
      ],
    },
    "separator",
    { label: "Properties", onSelect: () => os.openApp("about") },
  ];

  const iconMenu = (item: DesktopIconDefinition, selection: ReadonlySet<string>): ContextMenuItem[] => {
    const isBin = "appId" in item && item.appId === "recycleBin";
    const binLabel = DESKTOP_ICONS.find((icon) => "appId" in icon && icon.appId === "recycleBin")?.label;
    return [
      { label: "Open", bold: true, onSelect: () => openIcon(item) },
      ...(isBin
        ? [{ label: "Empty Recycle Bin", onSelect: () => say("Recycle Bin", petInBin ? "Kara is in there." : "It said no.") }]
        : []),
      "separator",
      {
        label: "Delete",
        onSelect: () =>
          isBin ? say("Recycle Bin", "Nice try.") : blinkAway([...selection].filter((label) => label !== binLabel)),
      },
      { label: "Rename", onSelect: () => say(item.label, "It likes its name.") },
      "separator",
      { label: "Properties", onSelect: () => say(`${item.label} Properties`, item.properties, "info") },
    ];
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    // No right click on phones, and a long press shouldn't pretend to be one.
    if (isPhone || isTouchPointer() || flight) return;

    const target = event.target as Element;
    // Only the desktop itself and its icons: not the menu or a message box sitting on top of it.
    if (target !== event.currentTarget && !target.closest(".kara-icon")) return;
    let { clientX: x, clientY: y } = event;
    // From the keyboard there's no pointer, so the menu opens at whatever has focus.
    if (x === 0 && y === 0) {
      const box = boxOf(target);
      x = box.left + 8;
      y = box.bottom - 4;
    }

    const label = iconLabel(target);
    const item = DESKTOP_ICONS.find((icon) => icon.label === label);
    if (!item) {
      setSelectedLabels(NOTHING_SELECTED);
      setMenu({ x, y, items: desktopMenu() });
      return;
    }
    const selection = selectedLabels.has(item.label) ? selectedLabels : new Set([item.label]);
    setSelectedLabels(selection);
    setMenu({ x, y, items: iconMenu(item, selection) });
  };

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
      icons: Array.from(desktop.querySelectorAll<HTMLElement>(".kara-icon")).map((icon) => ({
        label: icon.dataset.label ?? "",
        box: boxOf(icon),
      })),
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

  const handleIconPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, label: string) => {
    // Pressing one of several selected icons keeps them all, so they can be dragged together.
    const selection = selectedLabels.has(label) ? selectedLabels : new Set([label]);
    setSelectedLabels(selection);
    if (event.button !== 0 || event.pointerType === "touch" || isPhone || flight) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    iconDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      label,
      labels: [...selection],
      started: false,
      elements: [],
      boxes: {},
      bounds: new DOMRect(),
      limits: { left: 0, top: 0, right: 0, bottom: 0 },
      bin: null,
      overBin: false,
      overWindow: false,
      dx: 0,
      dy: 0,
    };
  };

  const startIconDrag = (drag: IconDrag, icon: HTMLElement) => {
    const desktop = desktopRef.current;
    if (!desktop) return;
    drag.started = true;
    drag.bounds = desktop.getBoundingClientRect();
    drag.elements = drag.labels.flatMap((label) => iconElement(label) ?? []);
    for (const element of drag.elements) drag.boxes[element.dataset.label ?? ""] = boxOf(element);
    // However far the whole group can go before one of them leaves the desktop.
    const boxes = Object.values(drag.boxes);
    drag.limits = {
      left: drag.bounds.left - Math.min(...boxes.map((box) => box.left)),
      right: drag.bounds.right - Math.max(...boxes.map((box) => box.right)),
      top: drag.bounds.top - Math.min(...boxes.map((box) => box.top)),
      bottom: drag.bounds.bottom - Math.max(...boxes.map((box) => box.bottom)),
    };
    const bin = desktop.querySelector<HTMLElement>('.kara-icon[data-app-id="recycleBin"]');
    drag.bin = bin && !drag.elements.includes(bin) ? bin : null;
    icon.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
  };

  const handleIconPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = iconDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.started) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
      startIconDrag(drag, event.currentTarget);
    }

    const { limits } = drag;
    drag.dx = Math.min(Math.max(event.clientX - drag.startX, limits.left), limits.right);
    drag.dy = Math.min(Math.max(event.clientY - drag.startY, limits.top), limits.bottom);
    setDragOffset({ labels: new Set(drag.labels), dx: drag.dx, dy: drag.dy });

    // Whatever is under the pointer once the carried icons are out of the way. A window over the bin hides it.
    const under = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => !drag.elements.some((carried) => carried.contains(element)));
    drag.overWindow = !!under?.closest(".kara-window");
    const overBin = !!under && !!drag.bin?.contains(under);
    if (overBin !== drag.overBin) {
      drag.overBin = overBin;
      drag.bin?.toggleAttribute("data-drop-target", overBin);
    }
  };

  const handleIconPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = iconDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    iconDragRef.current = null;

    if (!drag.started) {
      if (event.type === "pointerup") setSelectedLabels(new Set([drag.label]));
      return;
    }

    event.currentTarget.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    drag.bin?.removeAttribute("data-drop-target");
    setDragOffset(null);

    if (drag.overBin) {
      throwAway(drag.labels, drag.boxes);
      return;
    }
    if (drag.overWindow) {
      const returning = new Set(drag.labels);
      setSnappingBack(returning);
      later(() => setSnappingBack((current) => (current === returning ? null : current)), SNAP_BACK_MS);
      return;
    }

    const { bounds, boxes, dx, dy } = drag;
    const moved: Positions = {};
    for (const [label, box] of Object.entries(boxes)) {
      moved[label] = {
        x: ((box.left - bounds.left + dx) / bounds.width) * 100,
        y: ((box.top - bounds.top + dy) / bounds.height) * 100,
      };
    }
    setPositions((current) => ({ ...current, ...moved }));
  };

  const iconStyle = (label: string, index: number) => {
    if (isPhone) return phoneIconStyle(index);
    const { x, y } = positions[label];
    const style: CSSProperties = {
      // Percentages keep the mess on screen at any size; min() stops the last column running off the edge.
      left: `min(${x}%, calc(100% - var(--kara-icon-width)))`,
      top: `${y}%`,
    };
    if (flight?.stage === "going" && flight.labels.has(label)) {
      const delta = flight.deltas[label];
      if (delta) style.translate = `${delta.dx}px ${delta.dy}px`;
    } else if (dragOffset?.labels.has(label)) {
      style.translate = `${dragOffset.dx}px ${dragOffset.dy}px`;
    }
    return style;
  };

  const iconClassName = (label: string) => {
    const classNames = ["kara-icon"];
    if (selectedLabels.has(label)) classNames.push("kara-icon--selected");
    if (dragOffset?.labels.has(label)) classNames.push("kara-icon--dragging");
    if (snappingBack?.has(label)) classNames.push("kara-icon--snapping-back");
    if (blinking?.has(label)) classNames.push("kara-icon--blinking");
    if (flight?.labels.has(label)) classNames.push(flight.stage === "going" ? "kara-icon--to-bin" : "kara-icon--from-bin");
    return classNames.join(" ");
  };

  return (
    <div
      ref={desktopRef}
      className={`kara-desktop${refreshing ? " kara-desktop--refreshing" : ""}`}
      onPointerDown={handleDesktopPointerDown}
      onPointerMove={handleDesktopPointerMove}
      onPointerUp={handleDesktopPointerEnd}
      onPointerCancel={handleDesktopPointerEnd}
      onContextMenu={handleContextMenu}
    >
      {DESKTOP_ICONS.map((item, index) => {
        const { label, shortcut } = item;
        const Icon = "skin" in item ? item.icon : APPS[item.appId].icon;
        return (
          <button
            key={label}
            type="button"
            data-label={label}
            // How the pet finds the Recycle Bin to be thrown into.
            data-app-id={"appId" in item ? item.appId : undefined}
            className={iconClassName(label)}
            style={iconStyle(label, index)}
            onPointerDown={(event) => handleIconPointerDown(event, label)}
            onPointerMove={handleIconPointerMove}
            onPointerUp={handleIconPointerEnd}
            onPointerCancel={handleIconPointerEnd}
            {...openGesture(() => openIcon(item))}
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
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
      {message && <MessageBox title={message.title} message={message.text} kind={message.kind} onClose={() => setMessage(null)} />}
    </div>
  );
}

export default Desktop;
