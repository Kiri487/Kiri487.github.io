import { useMemo, useState } from "react";
import { useWindow } from "../../os/context";
import { usePetInBin } from "../../os/petBin";
import Explorer from "../explorer/Explorer";
import { FOLDERS, PET_FILE, folderPath } from "./folders";
import { openFile } from "./openFile";
import type { FolderArgs, FolderFile, FolderId } from "./types";

interface History {
  entries: FolderId[];
  index: number;
}

function FolderApp() {
  const { args, openApp, setTitle } = useWindow();
  const { folderId: startId } = args as FolderArgs;

  const [history, setHistory] = useState<History>({ entries: [startId], index: 0 });
  const [openedWith, setOpenedWith] = useState(args);
  const [restoredIds, setRestoredIds] = useState<ReadonlySet<string>>(() => new Set());
  const petInBin = usePetInBin();

  // Opening the app again resets the window's title, so the window has to go back to the folder that title names.
  if (args !== openedWith) {
    setOpenedWith(args);
    setHistory({ entries: [startId], index: 0 });
  }

  const folderId = history.entries[history.index];
  const folder = FOLDERS[folderId];

  const files = useMemo(() => {
    const kept = folder.files.filter((file) => !restoredIds.has(file.id));
    return folderId === "recycleBin" && petInBin ? [...kept, PET_FILE] : kept;
  }, [folder, folderId, restoredIds, petInBin]);

  const stepTo = (index: number) => {
    setHistory({ entries: history.entries, index });
    setTitle(FOLDERS[history.entries[index]].name);
  };

  const goToFolder = (id: FolderId) => {
    setHistory({ entries: [...history.entries.slice(0, history.index + 1), id], index: history.index + 1 });
    setTitle(FOLDERS[id].name);
  };

  const { parent } = folder;

  return (
    <Explorer<FolderFile>
      // Each folder starts with its own view, sort and selection.
      key={folderId}
      folderName={folder.name}
      path={folderPath(folderId)}
      files={files}
      taskGroups={folder.taskGroups}
      defaultSort={folder.defaultSort}
      onBack={history.index > 0 ? () => stepTo(history.index - 1) : undefined}
      onForward={history.index < history.entries.length - 1 ? () => stepTo(history.index + 1) : undefined}
      onUp={parent ? () => goToFolder(parent) : undefined}
      onOpenFile={(file, ordered) =>
        openFile(file, {
          ordered,
          openApp,
          goToFolder,
          restore: (fileId) => setRestoredIds((current) => new Set(current).add(fileId)),
        })
      }
    />
  );
}

export default FolderApp;
