import { useEffect, useState } from "react";

/** Runs at the right speed, but every hour and minute is past the end of its range: 01:01 reads 25:61. */
function formatKaraTime(now: Date): string {
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
