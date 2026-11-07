/**
 * True when the visitor has asked their system for less motion, often because movement on screen makes them
 * unwell. Read when something starts moving; a change applies from the next time it starts.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
