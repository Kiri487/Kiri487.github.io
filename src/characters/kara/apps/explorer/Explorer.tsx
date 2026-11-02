import { useCallback, useMemo, useRef, useState } from "react";
import { BackIcon, FolderIcon, ForwardIcon, SearchIcon, UpIcon } from "../../icons";
import { useDismiss } from "../../os/useDismiss";
import MessageBox from "../common/MessageBox";
import FileItem from "./FileItem";
import { sortFiles } from "./sortFiles";
import type { ExplorerFile, ExplorerSort, ExplorerSortKey, ExplorerTaskGroup, ExplorerView } from "./types";
import "./explorer.css";

const VIEWS: { id: ExplorerView; label: string }[] = [
  { id: "thumbnails", label: "Thumbnails" },
  { id: "icons", label: "Icons" },
  { id: "details", label: "Details" },
];

const SORT_KEYS: { id: ExplorerSortKey; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "type", label: "Type" },
  { id: "date", label: "Date Modified" },
];

/** Every menu except View is a dead end, and admits it. */
const FAKE_MENUS: { label: string; message: string }[] = [
  { label: "File", message: "File is busy being a file." },
  { label: "Edit", message: "Nothing in here has ever been edited." },
];
const FAKE_MENUS_AFTER_VIEW: { label: string; message: string }[] = [
  { label: "Favorites", message: "Kara doesn't have favorites. Kara has suspects." },
  { label: "Tools", message: "The tools are in the other folder." },
  { label: "Help", message: "Help is not coming." },
];

interface ExplorerProps<F extends ExplorerFile> {
  /** The title of the message box. */
  folderName: string;
  /** Shown after C:\Kara\ in the address bar. */
  path: string;
  files: F[];
  taskGroups: ExplorerTaskGroup[];
  defaultSort: ExplorerSort;
  /** Leave out when there is nowhere to go: Back and Forward turn off, and Up says so. */
  onBack?: () => void;
  onForward?: () => void;
  onUp?: () => void;
  /**
   * `ordered` is the folder as currently sorted, so a viewer can step through it in the same order.
   * Return a string to show it in the folder's message box.
   */
  onOpenFile: (file: F, ordered: F[]) => string | void;
}

function Explorer<F extends ExplorerFile>({
  folderName,
  path,
  files,
  taskGroups,
  defaultSort,
  onBack,
  onForward,
  onUp,
  onOpenFile,
}: ExplorerProps<F>) {
  const [view, setView] = useState<ExplorerView>("thumbnails");
  const [sort, setSort] = useState<ExplorerSort>(defaultSort);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<"view" | "views" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const menusRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  useDismiss(menusRef, openMenu !== null, closeMenu);

  const ordered = useMemo(() => sortFiles(files, sort), [files, sort]);
  const selected = files.find((file) => file.id === selectedId) ?? null;

  const chooseView = (next: ExplorerView) => {
    setView(next);
    closeMenu();
  };

  // Choosing the current key flips the direction, the same as clicking a column header twice.
  const chooseSort = (key: ExplorerSortKey) => {
    setSort((current) => ({ key, descending: current.key === key ? !current.descending : false }));
    closeMenu();
  };

  const renderViewChoices = () =>
    VIEWS.map(({ id, label }) => (
      <button key={id} type="button" className="kara-explorer__menu-item" onClick={() => chooseView(id)}>
        <span className="kara-explorer__menu-mark">{view === id ? "●" : ""}</span>
        {label}
      </button>
    ));

  return (
    <div className="kara-explorer">
      <div ref={menusRef} className="kara-explorer__bars">
        <div className="kara-explorer__menu-bar">
          {FAKE_MENUS.map((menu) => (
            <button key={menu.label} type="button" className="kara-explorer__menu" onClick={() => setMessage(menu.message)}>
              {menu.label}
            </button>
          ))}
          <div className="kara-explorer__menu-anchor">
            <button
              type="button"
              className="kara-explorer__menu"
              aria-expanded={openMenu === "view"}
              onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}
            >
              View
            </button>
            {openMenu === "view" && (
              <div className="kara-explorer__dropdown">
                {renderViewChoices()}
                <div className="kara-explorer__menu-separator" />
                <div className="kara-explorer__menu-heading">Arrange Icons by</div>
                {SORT_KEYS.map(({ id, label }) => (
                  <button key={id} type="button" className="kara-explorer__menu-item" onClick={() => chooseSort(id)}>
                    <span className="kara-explorer__menu-mark">{sort.key === id ? "●" : ""}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {FAKE_MENUS_AFTER_VIEW.map((menu) => (
            <button key={menu.label} type="button" className="kara-explorer__menu" onClick={() => setMessage(menu.message)}>
              {menu.label}
            </button>
          ))}
        </div>

        <div className="kara-explorer__toolbar">
          <button type="button" className="kara-explorer__tool" disabled={!onBack} aria-label="Back" onClick={onBack}>
            <BackIcon size={22} />
            Back
          </button>
          <button type="button" className="kara-explorer__tool" disabled={!onForward} aria-label="Forward" onClick={onForward}>
            <ForwardIcon size={22} />
          </button>
          <button
            type="button"
            className="kara-explorer__tool"
            aria-label="Up"
            onClick={onUp ?? (() => setMessage("There is nothing above this folder. Kara checked."))}
          >
            <UpIcon size={22} />
          </button>
          <span className="kara-explorer__tool-separator" />
          <button type="button" className="kara-explorer__tool" onClick={() => setMessage("Still looking for it.")}>
            <SearchIcon size={22} />
            Search
          </button>
          <button
            type="button"
            className="kara-explorer__tool"
            onClick={() => setMessage("The folders asked for some privacy.")}
          >
            <FolderIcon size={22} />
            Folders
          </button>
          <span className="kara-explorer__tool-separator" />
          <div className="kara-explorer__menu-anchor">
            <button
              type="button"
              className="kara-explorer__tool"
              aria-expanded={openMenu === "views"}
              onClick={() => setOpenMenu(openMenu === "views" ? null : "views")}
            >
              Views ▾
            </button>
            {openMenu === "views" && <div className="kara-explorer__dropdown">{renderViewChoices()}</div>}
          </div>
        </div>

        <div className="kara-explorer__address">
          <span className="kara-explorer__address-label">Address</span>
          <span className="kara-explorer__address-path">
            <FolderIcon size={16} />
            C:\Kara\{path}
          </span>
        </div>
      </div>

      <div className="kara-explorer__main">
        <aside className="kara-explorer__tasks">
          {taskGroups.map((group) => (
            <section key={group.title} className="kara-explorer__task-group">
              <h3 className="kara-explorer__task-title">{group.title}</h3>
              <div className="kara-explorer__task-list">
                {group.tasks.map((task) => (
                  <button
                    key={task.label}
                    type="button"
                    className="kara-explorer__task"
                    onClick={() => setMessage(task.message)}
                  >
                    {task.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <div
          className="kara-explorer__content"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          {view === "details" && (
            <div className="kara-explorer__details-header">
              {SORT_KEYS.map(({ id, label }) => (
                <button key={id} type="button" className="kara-explorer__column" onClick={() => chooseSort(id)}>
                  {label}
                  {sort.key === id ? (sort.descending ? " ▾" : " ▴") : ""}
                </button>
              ))}
            </div>
          )}
          <div
            className={`kara-explorer__files kara-explorer__files--${view}`}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            {ordered.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                view={view}
                selected={file.id === selectedId}
                onSelect={() => setSelectedId(file.id)}
                onOpen={() => {
                  const reply = onOpenFile(file, ordered);
                  if (reply) setMessage(reply);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="kara-explorer__status">
        {selected ? `${selected.name} (${selected.typeName})` : `${files.length} objects`}
      </div>

      {message && <MessageBox title={folderName} message={message} onClose={() => setMessage(null)} />}
    </div>
  );
}

export default Explorer;
