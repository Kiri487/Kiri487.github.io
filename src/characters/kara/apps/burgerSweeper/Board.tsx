import { memo, useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import hamburger from "../../assets/fluent-emoji/hamburger.svg";
import triangularFlag from "../../assets/fluent-emoji/triangular-flag.svg";
import type { Game } from "./game";
import { useRasterIcon } from "./rasterIcon";

const LONG_PRESS_MS = 450;

export type Mode = "dig" | "flag";

interface CellProps {
  index: number;
  open: boolean;
  flagged: boolean;
  burger: boolean;
  count: number;
  hit: boolean;
  wrong: boolean;
  disabled: boolean;
  /** Pictures shared by every cell. They're plain strings, so a cell still only redraws when it changes. */
  burgerSrc: string;
  flagSrc: string;
}

/**
 * One cell, given only plain values: a move copies the whole board, but only the cells that actually changed
 * draw again. Its events are handled by the board, so there's nothing here to recreate either.
 */
const Cell = memo(function Cell({
  index,
  open,
  flagged,
  burger,
  count,
  hit,
  wrong,
  disabled,
  burgerSrc,
  flagSrc,
}: CellProps) {
  const classNames = ["kara-sweeper__cell"];
  if (open) classNames.push("kara-sweeper__cell--open");
  if (hit) classNames.push("kara-sweeper__cell--hit");
  if (wrong) classNames.push("kara-sweeper__cell--wrong");
  if (open && !burger && count > 0) classNames.push(`kara-sweeper__cell--${count}`);

  let content = null;
  // Sized by the stylesheet, to fit the cell.
  if (flagged) content = <img src={flagSrc} alt="" draggable={false} />;
  else if (open && burger) content = <img src={burgerSrc} alt="" draggable={false} />;
  else if (open && count > 0) content = <span className="kara-sweeper__count">{count}</span>;

  return (
    <button
      type="button"
      data-index={index}
      className={classNames.join(" ")}
      disabled={disabled}
      aria-label={open ? (burger ? "Burger" : String(count || "Empty")) : flagged ? "Flagged" : "Hidden"}
    >
      {content}
    </button>
  );
});

interface BoardProps {
  game: Game;
  mode: Mode;
  /** Both must stay the same between renders, or every move draws the whole board again. */
  onDig: (index: number) => void;
  onFlag: (index: number) => void;
}

function indexOf(event: { target: EventTarget }): number | null {
  const cell = (event.target as Element).closest<HTMLElement>("[data-index]");
  return cell ? Number(cell.dataset.index) : null;
}

/** The field. Mouse: click digs, right click flags. Touch: a tap does what the mode says, a long press the other. */
function Board({ game, mode, onDig, onFlag }: BoardProps) {
  const burgerSrc = useRasterIcon(hamburger);
  const flagSrc = useRasterIcon(triangularFlag);
  const pressRef = useRef<{ timer: number | undefined; index: number | null; longPressed: boolean; pointerType: string }>({
    timer: undefined,
    index: null,
    longPressed: false,
    pointerType: "mouse",
  });

  useEffect(() => {
    const press = pressRef.current;
    return () => window.clearTimeout(press.timer);
  }, []);

  const cancelLongPress = () => window.clearTimeout(pressRef.current.timer);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    press.pointerType = event.pointerType;
    press.longPressed = false;
    press.index = indexOf(event);
    cancelLongPress();
    if (event.pointerType !== "touch" || press.index === null) return;
    const index = press.index;
    press.timer = window.setTimeout(() => {
      press.longPressed = true;
      navigator.vibrate?.(15);
      if (mode === "dig") onFlag(index);
      else onDig(index);
    }, LONG_PRESS_MS);
  };

  // Sliding off the cell before the long press is up means it wasn't one.
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (indexOf(event) !== pressRef.current.index) cancelLongPress();
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    cancelLongPress();
    const index = indexOf(event);
    if (press.longPressed) {
      press.longPressed = false;
      return;
    }
    if (index === null) return;
    if (press.pointerType === "touch" && mode === "flag" && !game.cells[index].open) onFlag(index);
    else onDig(index);
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const index = indexOf(event);
    // A long press on a phone has already been taken care of.
    if (index !== null && pressRef.current.pointerType !== "touch") onFlag(index);
  };

  const ended = game.status === "won" || game.status === "lost";
  const style = { "--rows": game.rows, "--cols": game.cols } as CSSProperties;

  return (
    <div
      className="kara-sweeper__board"
      style={style}
      role="grid"
      aria-label="Burger field"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {game.cells.map((cell, index) => (
        <Cell
          key={index}
          index={index}
          open={cell.open}
          flagged={cell.flagged}
          burger={cell.burger}
          count={cell.count}
          hit={index === game.hitIndex}
          wrong={game.status === "lost" && cell.flagged && !cell.burger}
          disabled={ended}
          burgerSrc={burgerSrc}
          flagSrc={flagSrc}
        />
      ))}
    </div>
  );
}

export default memo(Board);
