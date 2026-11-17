import { useState, type Ref } from "react";
import { DEFAULT_TUNING, type Tuning } from "./engine/tuning";
import { describeTuning, loadTuning, saveTuning } from "./devTuning";
import { forgetDoor } from "./door";
import type { XnPreview } from "./game";
import { XN_ACTIONS, type XnAction, type XnCrouch, type XnSit, type XnSurface } from "./xn";

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

const SURFACES: readonly [XnSurface, string][] = [
  ["floor", "地板"],
  ["ceiling", "天花板"],
  ["wall", "牆面"],
];

const ACTION_LABELS: Record<XnAction, string> = {
  stand: "站著",
  lamp: "盯著燈",
  carpet: "盯著地毯",
  faceWall: "面壁",
  crouch: "蹲下",
  sit: "坐著抱膝",
  spin: "原地慢轉",
};

/** A pose's settings in the panel: setting, label, range. */
type PoseSliders<T> = readonly [keyof T & string, string, number, number][];

const CROUCH_SLIDERS: PoseSliders<XnCrouch> = [
  ["depth", "蹲多低", 0, 1],
  ["arms", "手臂往前抬", 0, 1.6],
  ["armsIn", "手往內收", -0.3, 0.8],
  ["knees", "膝蓋打開", 0, 0.8],
  ["lean", "身體前傾", 0, 0.9],
];

const SIT_SLIDERS: PoseSliders<XnSit> = [
  ["seat", "屁股高度", 0, 0.08],
  ["knees", "膝蓋抬多高", 1.4, 2.8],
  ["spread", "膝蓋打開", 0, 0.6],
  ["lean", "身體前傾", 0, 0.9],
  ["arms", "手臂往前抬", 0, 1.8],
  ["fold", "前臂往內折", 0, 2],
  ["feet", "腳掌貼平", 0, 1],
];

function describePose<T>(name: string, sliders: PoseSliders<T>, values: T): string {
  return `${name}：${sliders.map(([key, label]) => `${label} ${(values[key] as number).toFixed(2)}`).join("｜")}`;
}

/** The panel's checkboxes for XN: what goes on top of any action, and noticing. */
const XN_CHECKS: readonly ["auto" | "tailUp" | "swingArms" | "ignore", string][] = [
  ["auto", "XN 自己出現和瞬移（關掉才會一直留在你前面）"],
  ["tailUp", "尾巴豎起"],
  ["swingArms", "手臂晃"],
  ["ignore", "XN 不理玩家（只看動作，不轉頭看你）"],
];

interface DevPanelProps {
  panelRef: Ref<HTMLDivElement>;
  onTune: (next: Tuning, freshMap: boolean) => void;
  xnPreview: XnPreview;
  onXnPreview: (next: XnPreview, restart: boolean) => void;
  onMoveXnOn: () => void;
}

function DevPanel({ panelRef, onTune, xnPreview, onXnPreview, onMoveXnOn }: DevPanelProps) {
  const [tuning, setTuning] = useState(loadTuning);
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const [poseCopied, setPoseCopied] = useState<"" | "done" | "failed">("");

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

  // The sliders for the pose she's in, if it has any.
  const pose =
    xnPreview.action === "crouch"
      ? {
          summary: describePose("蹲下", CROUCH_SLIDERS, xnPreview.crouch),
          sliders: CROUCH_SLIDERS.map(([key, label, min, max]) => ({
            key,
            label,
            min,
            max,
            value: xnPreview.crouch[key],
            set: (value: number) => onXnPreview({ ...xnPreview, crouch: { ...xnPreview.crouch, [key]: value } }, false),
          })),
        }
      : xnPreview.action === "sit"
        ? {
            summary: describePose("坐著抱膝", SIT_SLIDERS, xnPreview.sit),
            sliders: SIT_SLIDERS.map(([key, label, min, max]) => ({
              key,
              label,
              min,
              max,
              value: xnPreview.sit[key],
              set: (value: number) => onXnPreview({ ...xnPreview, sit: { ...xnPreview.sit, [key]: value } }, false),
            })),
          }
        : null;

  const copyPose = () => {
    if (!pose) return;
    navigator.clipboard.writeText(pose.summary).then(
      () => setPoseCopied("done"),
      () => setPoseCopied("failed"),
    );
    window.setTimeout(() => setPoseCopied(""), 1800);
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

      <h3>XN 動作預覽</h3>
      <p className="kara-xnen-dev__note">
        按表面或動作，XN 會移到你前方；再按一次同一個動作＝從頭再做。按畫面繼續播放才會動。
      </p>
      <div className="kara-xnen-dev__buttons">
        <button type="button" onClick={onMoveXnOn}>
          XN 馬上瞬移
        </button>
      </div>
      <div className="kara-xnen-dev__buttons" role="group" aria-label="XN 在哪個面">
        {SURFACES.map(([surface, label]) => (
          <button
            key={surface}
            type="button"
            aria-pressed={xnPreview.surface === surface}
            onClick={() =>
              onXnPreview(
                {
                  ...xnPreview,
                  surface,
                  // There's no wall to face from a wall.
                  action: surface === "wall" && xnPreview.action === "faceWall" ? "stand" : xnPreview.action,
                },
                true,
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="kara-xnen-dev__buttons" role="group" aria-label="XN 的動作">
        {XN_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            aria-pressed={xnPreview.action === action}
            disabled={action === "faceWall" && xnPreview.surface === "wall"}
            onClick={() => onXnPreview({ ...xnPreview, action }, true)}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
      <div className="kara-xnen-dev__checks">
        {XN_CHECKS.map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={xnPreview[key]}
              onChange={(e) => onXnPreview({ ...xnPreview, [key]: e.target.checked }, false)}
            />
            {label}
          </label>
        ))}
      </div>
      <label className="kara-xnen-dev__field">
        <span>
          幾格內才看你 <b>{xnPreview.noticeRange.toFixed(1)}</b>
        </span>
        <input
          type="range"
          min={1}
          max={12}
          step={0.5}
          value={xnPreview.noticeRange}
          onChange={(e) => onXnPreview({ ...xnPreview, noticeRange: Number(e.target.value) }, false)}
        />
      </label>
      {pose && (
        <>
          {pose.sliders.map(({ key, label, min, max, value, set }) => (
            <label key={key} className="kara-xnen-dev__field">
              <span>
                {label} <b>{value.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={0.01}
                value={value}
                onChange={(e) => set(Number(e.target.value))}
              />
            </label>
          ))}
          <div className="kara-xnen-dev__buttons">
            <button type="button" onClick={copyPose}>
              {poseCopied === "done" ? "已複製" : poseCopied === "failed" ? "請手動選取下面文字" : "複製姿勢設定"}
            </button>
          </div>
          <output className="kara-xnen-dev__summary">{pose.summary}</output>
        </>
      )}
    </div>
  );
}

export default DevPanel;
