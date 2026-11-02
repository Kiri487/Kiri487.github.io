import { useSyncExternalStore } from "react";
import { MOBILE_QUERY } from "../../../shared/breakpoints";

const query = window.matchMedia(MOBILE_QUERY);

function subscribe(onChange: () => void) {
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Follows the screen as it rotates or resizes. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => query.matches);
}
