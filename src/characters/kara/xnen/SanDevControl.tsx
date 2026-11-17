import { formatSan, SAN_STAGE_LABEL } from "./devFlags";
import { SAN_DEV_RANGE, SAN_LOW_AT, SAN_MIDDLE_AT, setSanExposure, stageAt, useSanSeconds } from "./san";

/*
 * Dev builds only: SAN on Kara's desktop, live, to set it without going through the door. Plain inline styles: it's a
 * tool, not part of the page.
 */

/**
 * Where the quick buttons put SAN: high, half way through the middle, and a minute into low, since the desktop takes a
 * second back every second and right on the line would be middle again at once.
 */
const PRESETS: readonly [string, number][] = [
  ["高", 0],
  ["中", Math.round((SAN_MIDDLE_AT + SAN_LOW_AT) / 2)],
  ["低", SAN_LOW_AT + 60],
];

function SanDevControl() {
  const seconds = useSanSeconds();

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        bottom: "calc(var(--kara-taskbar-height) + 8px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "rgba(0, 0, 0, 0.75)",
        color: "#fff",
        font: "12px system-ui, 'Microsoft JhengHei', sans-serif",
      }}
    >
      <span>
        SAN {formatSan(seconds)}（{SAN_STAGE_LABEL[stageAt(seconds)]}）
      </span>
      <input
        type="range"
        min={0}
        max={SAN_DEV_RANGE}
        value={seconds}
        aria-label="SAN：在後室累積的秒數"
        onChange={(e) => setSanExposure(Number(e.target.value))}
      />
      {PRESETS.map(([label, value]) => (
        <button key={label} type="button" onClick={() => setSanExposure(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default SanDevControl;
