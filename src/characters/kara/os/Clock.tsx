import { useEffect, useState } from "react";

/**
 * Runs at the right speed, but every hour and minute is past the end of its range: 01:01 reads 25:61.
 * The one exception is 4:20, twice a day.
 */
function formatKaraTime(now: Date): string {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours % 12 === 4 && minutes === 20) return "4:20";
  return `${hours + 24}:${minutes + 60}`;
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
