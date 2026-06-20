import type { CSSProperties } from "react";

interface PlaceholderProps {
  /** Asset id — must match the filename listed in ASSETS.md. */
  name: string;
  width?: number | string;
  height?: number | string;
  /** Short description of what to draw. */
  note?: string;
}

/**
 * A labelled stand-in for hand-drawn artwork that does not exist yet.
 * Reserves the final layout size so swapping in real art changes nothing.
 */
function Placeholder({ name, width = "100%", height = 240, note }: PlaceholderProps) {
  const style: CSSProperties = { width, height };
  const dims =
    typeof width === "number" && typeof height === "number"
      ? `${width} × ${height}`
      : undefined;

  return (
    <div
      className="kuru-placeholder"
      style={style}
      role="img"
      aria-label={`Artwork placeholder: ${name}${note ? ` — ${note}` : ""}`}
    >
      <span className="kuru-placeholder__tag">ART NEEDED</span>
      <span className="kuru-placeholder__name">{name}</span>
      {note && <span className="kuru-placeholder__note">{note}</span>}
      {dims && <span className="kuru-placeholder__size">{dims}</span>}
    </div>
  );
}

export default Placeholder;
