/** Any item except the previous one, so doing something twice always gets a new answer. */
export function pickDifferent<T>(items: T[], previous: T | null): T {
  const choices = items.filter((item) => item !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}
