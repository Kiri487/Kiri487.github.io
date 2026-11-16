import { useState, type Ref } from "react";
import { DEFAULT_TUNING, type Tuning } from "./engine/tuning";
import { describeTuning, loadTuning, saveTuning } from "./devTuning";
import { forgetDoor } from "./door";

/* Dev builds only: Kiri's sliders for tuning the place. The changes are kept, and 複製設定 copies them to paste back. */

type NumberKey = "fog" | "yellow" | "bright" | "dead" | "fov" | "compass" | "region" | "spawnMin" | "spawnMax";

/** Setting, label and range. */
const SLIDERS: readonly [NumberKey, string, number, number][] = [
  ["fog", "霧", 0, 100],
  ["yellow", "泛黃", 0, 160],
  ["bright", "亮度", 30, 180],
  ["dead", "壞掉的燈", 0, 85],
  ["fov", "視野", 55, 100],
  ["compass", "時間碼距離（%）", 40, 250],
  ["region", "神像區塊大小（換地圖後生效）", 40, 220],
  ["spawnMin", "最近神像至少幾格（換地圖後生效）", 10, 300],
  ["spawnMax", "最近神像至多幾格（換地圖後生效）", 20, 400],
];

const RESOLUTIONS = [100, 140, 180, 240, 360];

interface DevPanelProps {
  panelRef: Ref<HTMLDivElement>;
  onTune: (next: Tuning, freshMap: boolean) => void;
}

function DevPanel({ panelRef, onTune }: DevPanelProps) {
  const [tuning, setTuning] = useState(loadTuning);
  const [copied, setCopied] = useState<"" | "done" | "failed">("");

  const change = (patch: Partial<Tuning>, freshMap = false) => {
    const next = { ...tuning, ...patch };
    if (next.spawnMax < next.spawnMin) next.spawnMax = next.spawnMin;
    setTuning(next);
    saveTuning(next);
    onTune(next, freshMap);
  };

  const copy = () => {
    navigator.clipboard.writeText(describeTuning(tuning)).then(
      () => setCopied("done"),
      () => setCopied("failed"),
    );
    window.setTimeout(() => setCopied(""), 1800);
  };

  return (
    <div className="kara-xnen-dev" ref={panelRef}>
      <h2>畫面調整（只有開發環境）</h2>
      <label className="kara-xnen-dev__field">
        <span>解析度（短邊像素）</span>
        <select value={tuning.res} onChange={(e) => change({ res: Number(e.target.value) })}>
          {RESOLUTIONS.map((res) => (
            <option key={res} value={res}>
              {res}
            </option>
          ))}
        </select>
      </label>
      {SLIDERS.map(([key, label, min, max]) => (
        <label key={key} className="kara-xnen-dev__field">
          <span>
            {label} <b>{tuning[key]}</b>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            value={tuning[key]}
            onChange={(e) => {
              const patch: Partial<Tuning> = {};
              patch[key] = Number(e.target.value);
              change(patch);
            }}
          />
        </label>
      ))}
      <div className="kara-xnen-dev__checks">
        <label>
          <input type="checkbox" checked={tuning.bob} onChange={(e) => change({ bob: e.target.checked })} />
          走路晃動
        </label>
        <label>
          <input type="checkbox" checked={tuning.hum} onChange={(e) => change({ hum: e.target.checked })} />
          日光燈嗡嗡聲
        </label>
      </div>
      <div className="kara-xnen-dev__buttons">
        <button type="button" onClick={() => change({}, true)}>
          換一張地圖
        </button>
        <button type="button" onClick={() => change({ ...DEFAULT_TUNING }, true)}>
          還原預設
        </button>
        <button type="button" onClick={forgetDoor}>
          忘記門
        </button>
        <button type="button" onClick={copy}>
          {copied === "done" ? "已複製" : copied === "failed" ? "請手動選取下面文字" : "複製設定"}
        </button>
      </div>
      <output className="kara-xnen-dev__summary">{describeTuning(tuning)}</output>
    </div>
  );
}

export default DevPanel;
