/*
 * ROT13, and how much of it the visitor sees through, a word at a time. Kept apart from XN's lines so Kara's desktop
 * can use it without loading them.
 *
 * Every word has its own fixed point between 0 and 1, the same wherever it's said. XN's words read plainly once the
 * visitor's share passes their point; the other cats' words turn to ROT13 the same way. So the first words of XN's
 * that the visitor learns are the first ones the other cats lose.
 */

/** ROT13: each letter thirteen places on. Doing it twice gives the original back. */
export function rot13(text: string): string {
  return text.replace(/[a-z]/gi, (letter) => {
    const base = letter <= "Z" ? 65 : 97;
    return String.fromCharCode(((letter.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** A word's fixed point, 0 to 1. */
function pointOf(word: string): number {
  // FNV-1a over the word, lower-cased so "Kara" and "kara" go together.
  let hash = 0x811c9dc5;
  for (const char of word.toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

/** A word is its letters, with any apostrophes inside (that's, i've). */
const WORD = /[a-z]+(?:'[a-z]+)*/gi;

/** XN's line as read when `readable` (0 to 1) of her speech comes through: 0 is all ROT13, 1 all plain. */
export function readAs(line: string, readable: number): string {
  if (readable <= 0) return rot13(line);
  if (readable >= 1) return line;
  return line.replace(WORD, (word) => (pointOf(word) < readable ? word : rot13(word)));
}

/** Another cat's line when `lost` (0 to 1) of it has turned to ROT13: 0 is all plain, 1 all ROT13. */
export function garble(line: string, lost: number): string {
  if (lost <= 0) return line;
  if (lost >= 1) return rot13(line);
  return line.replace(WORD, (word) => (pointOf(word) < lost ? rot13(word) : word));
}
