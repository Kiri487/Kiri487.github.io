/*
 * The date in the corner of the tape: today's month and day, 13 years back (the mark K and X share), and always a
 * Thursday, whatever today is. Thursday is the day Kara deleted; this is where it went.
 */

const MONTHS = ["JAN.", "FEB.", "MAR.", "APR.", "MAY", "JUN.", "JUL.", "AUG.", "SEP.", "OCT.", "NOV.", "DEC."];

export function dateStamp(today: Date): string {
  return `THU. ${MONTHS[today.getMonth()]} ${today.getDate()} ${today.getFullYear() - 13}`;
}

/** The timecode line above it: always AM 4, then the compass digits. */
export function timeStamp(digits: string): string {
  return `AM 4:${digits}`;
}
