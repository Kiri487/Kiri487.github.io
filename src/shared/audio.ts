/* One AudioContext for the whole site. Skins are swapped without a page load, and a context is never closed, so
   each skin making its own would leave one more running on every visit. Sounds themselves stay with each skin. */

let ctx: AudioContext | null = null;

/** The site's context, created on first use. It may still be suspended until a click lets it start. */
export function getAudioContext(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

/** The context, asked to start if it hasn't yet. Call from a click so the browser allows it. */
export function resumeAudioContext(): AudioContext {
  const c = getAudioContext();
  if (c.state === "suspended") void c.resume().catch(() => {});
  return c;
}
