/**
 * Kiri's dev tools for XN: the tuning panel in the backrooms and the SAN control on the desktop. Dev builds only, and
 * only while this is on. Off, a dev build plays with the defaults, as visitors do; her saved tuning stays put for
 * when it's back on.
 */
const DEV_PANEL = false;

export const XN_DEV_TOOLS = import.meta.env.DEV && DEV_PANEL;

/** SAN's stages, as the dev controls name them. */
export const SAN_STAGE_LABEL = { high: "高", middle: "中", low: "低" } as const;

/** Seconds as m:ss, for the dev controls. */
export function formatSan(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
