/** The top edge of a window or desktop icon, which is something a cat can stand on. In the same coordinates as the pet. */
export interface Ledge {
  element: HTMLElement;
  top: number;
  left: number;
  right: number;
}

function readLedge(element: HTMLElement): Ledge {
  const { top, left, right } = element.getBoundingClientRect();
  return { element, top, left, right };
}

/**
 * The same window's edge as it is now, or null if there's no standing on it any more: closed, minimized, or
 * maximized, whose edge is the top of the screen with no room above it and no end to walk off.
 */
export function refreshLedge({ element }: Ledge): Ledge | null {
  const { classList } = element;
  if (!element.isConnected || classList.contains("kara-window--minimized") || classList.contains("kara-window--maximized")) {
    return null;
  }
  return readLedge(element);
}

/**
 * The first window edge met going down from fromY to toY at this x. An edge another window covers
 * isn't there to stand on, so she falls past it.
 */
export function findLedge(
  root: Element,
  x: number,
  fromY: number,
  toY: number,
  /** Where the edges were last frame, kept up to date here. A window can rise past her faster than she falls. */
  previousTops?: Map<HTMLElement, number>,
): Ledge | null {
  // Icons have no z-index, so they sort below every window, which is where they are.
  const surfaces = Array.from(root.querySelectorAll<HTMLElement>(".kara-window:not(.kara-window--minimized), .kara-icon"))
    .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }));

  let found: Ledge | null = null;
  surfaces.forEach(({ element, rect }, index) => {
    const previousTop = previousTops?.get(element) ?? rect.top;
    previousTops?.set(element, rect.top);
    if (x < rect.left || x > rect.right || previousTop < fromY || rect.top > toY) return;
    if (found && rect.top >= found.top) return;
    const covered = surfaces
      .slice(0, index)
      .some((above) => x >= above.rect.left && x <= above.rect.right && rect.top >= above.rect.top && rect.top < above.rect.bottom);
    if (!covered) found = readLedge(element);
  });
  return found;
}
