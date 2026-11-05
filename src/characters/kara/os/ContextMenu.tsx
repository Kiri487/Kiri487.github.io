import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "./useDismiss";

export type ContextMenuItem =
  | "separator"
  | {
      label: string;
      /** The default action, in bold like the one a double click does. */
      bold?: boolean;
      /** Marked as the current choice, such as a game's difficulty. */
      checked?: boolean;
      onSelect?: () => void;
      submenu?: ContextMenuItem[];
    };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Room to keep from the screen's edges, so a menu opened near one never runs off it. */
const EDGE = 2;

/** Moves the list back on screen once it's measured: to the other side of the point, like XP, when there's no room. */
function useOnScreen(x: number, y: number, flipFrom?: number) {
  const ref = useRef<HTMLDivElement>(null);

  // Written straight to the element before the first paint, so it never shows up off screen first.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    let left = x;
    if (left + width > window.innerWidth - EDGE) left = (flipFrom ?? x) - width;
    let top = y;
    if (top + height > window.innerHeight - EDGE) top = window.innerHeight - EDGE - height;
    element.style.left = `${Math.max(EDGE, left)}px`;
    element.style.top = `${Math.max(EDGE, top)}px`;
  }, [x, y, flipFrom]);

  return ref;
}

interface MenuListProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  /** For a submenu, the parent's left edge: where it goes instead when there's no room on the right. */
  flipFrom?: number;
  onClose: () => void;
}

function MenuList({ items, x, y, flipFrom, onClose }: MenuListProps) {
  const ref = useOnScreen(x, y, flipFrom);
  const [openSubmenu, setOpenSubmenu] = useState<{ index: number; x: number; y: number; flipFrom: number } | null>(
    null,
  );

  const showSubmenu = (index: number, button: HTMLElement) => {
    const { right, top, left } = button.getBoundingClientRect();
    setOpenSubmenu({ index, x: right - 3, y: top - 3, flipFrom: left + 3 });
  };

  // Up and down move between the items, the same as Tab, so the menu works without a mouse.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    // A submenu sits inside its parent, which would otherwise move its own focus too.
    event.stopPropagation();
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(":scope > .kara-context-menu__item") ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    buttons[(current + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div
      ref={ref}
      className="kara-context-menu"
      role="menu"
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => {
        if (item === "separator") return <div key={`separator-${index}`} className="kara-context-menu__separator" />;
        const { label, bold, checked, onSelect, submenu } = item;
        return (
          <button
            key={label}
            type="button"
            role={checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={checked}
            className={`kara-context-menu__item${bold ? " kara-context-menu__item--bold" : ""}`}
            aria-haspopup={submenu ? "menu" : undefined}
            aria-expanded={submenu ? openSubmenu?.index === index : undefined}
            onPointerEnter={(event) => (submenu ? showSubmenu(index, event.currentTarget) : setOpenSubmenu(null))}
            onKeyDown={(event) => {
              if (submenu && event.key === "ArrowRight") showSubmenu(index, event.currentTarget);
            }}
            onClick={(event) => {
              if (submenu) {
                showSubmenu(index, event.currentTarget);
                return;
              }
              onClose();
              onSelect?.();
            }}
          >
            {checked && <span className="kara-context-menu__check" aria-hidden="true" />}
            {label}
            {submenu && <span className="kara-context-menu__arrow" aria-hidden="true" />}
          </button>
        );
      })}
      {openSubmenu && (
        <MenuList
          key={openSubmenu.index}
          items={(items[openSubmenu.index] as { submenu: ContextMenuItem[] }).submenu}
          x={openSubmenu.x}
          y={openSubmenu.y}
          flipFrom={openSubmenu.flipFrom}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/**
 * A menu at a point on the screen: a right-click menu, or one dropping from a window's menu bar. Pressing anywhere
 * else or Escape closes it. It's put on the desktop's root, since a window's transform would move it.
 */
function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [host] = useState(() => document.querySelector<HTMLElement>(".kara-os"));
  useDismiss(rootRef, true, onClose);

  useLayoutEffect(() => {
    // Focus on the menu, so the keyboard can go on from where the menu key or Shift+F10 left it.
    rootRef.current?.querySelector<HTMLButtonElement>(".kara-context-menu__item")?.focus({ preventScroll: true });
  }, []);

  const menu = (
    <div ref={rootRef} className="kara-context-menu-layer">
      <MenuList items={items} x={x} y={y} onClose={onClose} />
    </div>
  );
  return host ? createPortal(menu, host) : menu;
}

export default ContextMenu;
