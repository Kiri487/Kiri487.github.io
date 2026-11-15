/**
 * The words that call XR up from Kere's chat, and send the visitor back again. Shared by both, and kept in a small file
 * of its own so Kere can check for them without loading XR's code.
 */

/**
 * ROT13 is a Caesar cipher shifted by 13, and Kere through ROT13 is Xrer. Spaces and punctuation are already gone by
 * the time these are matched, so "rot-13", "ROT_13" and "凱薩加密 13" are covered too. "凱薩加密" alone isn't: a Caesar
 * cipher can shift by anything.
 */
export const ROT13_PHRASES = [
  "rot13",
  "rot 13",
  ...["凱薩", "凱撒"].flatMap((caesar) =>
    ["加密", "密碼"].flatMap((cipher) => [`${caesar}${cipher}13`, `${caesar}${cipher}十三`]),
  ),
];

/** In Kere's chat, any of these hands the visitor over to XR, before anything else is checked. */
export const XR_TRIGGERS = ["xrer", ...ROT13_PHRASES];

/** Full-width letters and digits ("ｒｏｔ１３", easy to type with a Chinese IME) as ordinary ones. */
export function halfWidth(text: string): string {
  return text.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
