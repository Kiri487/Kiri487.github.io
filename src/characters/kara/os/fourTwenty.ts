/** The one minute, twice a day, when this computer knows what time it is. */
export function isFourTwenty(now: Date): boolean {
  return now.getHours() % 12 === 4 && now.getMinutes() === 20;
}
