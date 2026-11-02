import { useEffect, useState } from "react";
import { isFourTwenty } from "./fourTwenty";

/**
 * Runs at the right speed, but every hour and minute is past the end of its range: 01:01 reads 25:61.
 * The one exception is 4:20, twice a day.
 */
function formatKaraTime(now: Date): string {
  if (isFourTwenty(now)) return "4:20";
  return `${now.getHours() + 24}:${now.getMinutes() + 60}`;
}

function Clock() {
  const [time, setTime] = useState(() => formatKaraTime(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatKaraTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className="kara-tray__clock">{time}</span>;
}

export default Clock;
