import type { CSSProperties } from "react";

/**
 * Out of sight but still read out by screen readers and found by search engines. Put on with `style`, for text
 * that has no place in the design: a page's heading, a spoken status, buttons the keyboard needs.
 */
export const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};
