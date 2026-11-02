import { useState } from "react";
import { BrokenImageIcon } from "../../icons";
import { openGesture } from "../../os/openGesture";
import type { ExplorerFile, ExplorerView } from "./types";

function Thumbnail({ file }: { file: ExplorerFile }) {
  const [failed, setFailed] = useState(false);
  const Icon = file.icon;

  if (!file.thumbnail) return <Icon size={48} />;
  if (failed) return <BrokenImageIcon size={48} />;
  return (
    <img
      className="kara-file__thumbnail"
      src={file.thumbnail}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

interface FileItemProps {
  file: ExplorerFile;
  view: ExplorerView;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function FileItem({ file, view, selected, onSelect, onOpen }: FileItemProps) {
  const Icon = file.icon;

  return (
    <button
      type="button"
      className={`kara-file kara-file--${view}${selected ? " kara-file--selected" : ""}`}
      aria-pressed={selected}
      onPointerDown={onSelect}
      {...openGesture(onOpen)}
    >
      {view === "thumbnails" && (
        <>
          <span className="kara-file__frame">
            <Thumbnail file={file} />
          </span>
          <span className="kara-file__name">{file.name}</span>
        </>
      )}
      {view === "icons" && (
        <>
          <Icon size={32} />
          <span className="kara-file__name">{file.name}</span>
        </>
      )}
      {view === "details" && (
        <>
          <span className="kara-file__cell kara-file__cell--name">
            <Icon size={16} />
            <span className="kara-file__name">{file.name}</span>
          </span>
          <span className="kara-file__cell">{file.typeName}</span>
          <span className="kara-file__cell">{file.date}</span>
        </>
      )}
    </button>
  );
}

export default FileItem;
