const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * When something started, as year * 12 + month, for sorting newest first. Reads the start of a "Mon YYYY - Mon YYYY"
 * period and falls back to January of the bare year.
 */
export function periodStart({ period, year }: { period?: string; year: string }): number {
  const match = period?.match(/^([A-Z][a-z]{2}) (\d{4})/);
  if (match) return parseInt(match[2], 10) * 12 + MONTHS.indexOf(match[1]);
  return parseInt(year, 10) * 12;
}
