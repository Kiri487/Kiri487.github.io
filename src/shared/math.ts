/** `value` kept within [min, max]. When the range is empty (max < min), min wins. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
