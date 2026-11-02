import { useState } from "react";
import { BrokenImageIcon, ComputerIcon, FolderIcon, ImageFileIcon, NotepadIcon } from "../../icons";
import Explorer from "../explorer/Explorer";
import type { ExplorerFile, ExplorerSort, ExplorerTaskGroup } from "../explorer/types";

interface BinFile extends ExplorerFile {
  message: string;
  /** Leaves the bin when opened. Only until the window closes: Kara throws it away again. */
  restorable?: boolean;
}

const FILES: BinFile[] = [
  {
    id: "burger",
    name: "chicken_burger.jpg",
    typeName: "Very Formal Burger",
    date: "Yesterday, probably",
    icon: ImageFileIcon,
    message: "Restored. It came back warm.",
    restorable: true,
  },
  {
    id: "tuesday",
    name: "Tuesday",
    typeName: "Day of the Week",
    date: "Tuesday (uninstalled)",
    icon: BrokenImageIcon,
    message: "Tuesday cannot be restored. Please stop asking.",
  },
  {
    id: "printer",
    name: "The Printer",
    typeName: "Rumor",
    date: "Friday, technically",
    icon: ComputerIcon,
    message: "The Printer is in a meeting.",
  },
  {
    id: "chair",
    name: "chair position.bak",
    typeName: "Backup",
    date: "Monday (still)",
    icon: NotepadIcon,
    message: "Restored. The room is unchanged.",
  },
  {
    id: "greg",
    name: "greg's old web",
    typeName: "Spider Property",
    date: "The 31st of February",
    icon: FolderIcon,
    message: "Greg would like this left where it is.",
  },
];

const BY_NAME: ExplorerSort = { key: "name", descending: false };

const TASK_GROUPS: ExplorerTaskGroup[] = [
  {
    title: "Recycle Bin Tasks",
    tasks: [
      { label: "Empty the Recycle Bin", message: "It said no." },
      { label: "Restore all items", message: "They know what they did." },
    ],
  },
];

function RecycleBinApp() {
  const [files, setFiles] = useState(FILES);

  const handleOpenFile = (file: ExplorerFile) => {
    const { id, message, restorable } = file as BinFile;
    if (restorable) setFiles((current) => current.filter((candidate) => candidate.id !== id));
    return message;
  };

  return (
    <Explorer
      folderName="Recycle Bin"
      files={files}
      taskGroups={TASK_GROUPS}
      defaultSort={BY_NAME}
      onOpenFile={handleOpenFile}
    />
  );
}

export default RecycleBinApp;
