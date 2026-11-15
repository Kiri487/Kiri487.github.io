/**
 * The words that call XR up from Kere's chat, and send the visitor back again. Shared by both, and kept in a small file
 * of its own so Kere can check for them without loading XR's code.
 */

/**
 * ROT13 is a Caesar cipher shifted by 13, and Kere through ROT13 is Xrer. English words match whole, with punctuation
 * turned into spaces, so "rot-13" and "ROT_13" are covered; Chinese ignores spaces, so "凱薩加密 13" is too. A Caesar
 * cipher alone isn't: it can shift by anything, and Kere's hints only lead up to it (see XR_HINT in Kere's script).
 */
export const ROT13_PHRASES = [
  ...["13", "thirteen"].flatMap((n) => [
    `rot${n}`,
    `rot ${n}`,
    `caesar${n}`,
    `caesar ${n}`,
    `caesar cipher ${n}`,
    `caesar shift ${n}`,
  ]),
  ...["凱薩", "凱撒"].flatMap((caesar) =>
    ["", "加密", "密碼"].flatMap((cipher) => [`${caesar}${cipher}13`, `${caesar}${cipher}十三`]),
  ),
];

/** In Kere's chat, any of these hands the visitor over to XR, before anything else is checked. */
export const XR_TRIGGERS = ["xrer", ...ROT13_PHRASES];

/** Full-width letters and digits ("ｒｏｔ１３", easy to type with a Chinese IME) as ordinary ones. */
export function halfWidth(text: string): string {
  return text.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
