/**
 * Kiri's dev tools for XN: the tuning panel in the backrooms and the SAN control on the desktop. Dev builds only, and
 * only while this is on. Off, a dev build plays with the defaults, as visitors do; her saved tuning stays put for
 * when it's back on.
 */
const DEV_PANEL = false;

export const XN_DEV_TOOLS = import.meta.env.DEV && DEV_PANEL;
