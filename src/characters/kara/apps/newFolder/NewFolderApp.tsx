import { FolderIcon, NotepadIcon } from "../../icons";
import { useWindow } from "../../os/context";
import Explorer from "../explorer/Explorer";
import type { ExplorerFile, ExplorerSort, ExplorerTaskGroup } from "../explorer/types";
import { notepadTitle, type NotepadArgs } from "../notepad/documents";

/** A file either raises a message or, with no message, opens as the text file it claims to be. */
interface FolderFile extends ExplorerFile {
  message?: string;
}

const TEXT_FILE_NAME = "what they are safe from.txt";
const TEXT_FILE_CONTENT = ":3";

const FILES: FolderFile[] = [
  {
    id: "folder-1",
    name: "新增資料夾 (1) - Shortcut",
    typeName: "Shortcut",
    date: "Tuesday (uninstalled)",
    icon: FolderIcon,
    message: "This folder is safe.",
  },
  {
    id: "folder-2",
    name: "新增資料夾 (2) - Shortcut",
    typeName: "Shortcut",
    date: "Tuesday (uninstalled)",
    icon: FolderIcon,
    message: "This folder is safe from you specifically.",
  },
  {
    id: "folder-4",
    name: "新增資料夾 (4)",
    typeName: "File Folder",
    date: "Not yet",
    icon: FolderIcon,
    message: "This one hasn't happened yet.",
  },
  {
    id: "safe-from",
    name: TEXT_FILE_NAME,
    typeName: "Text Document",
    date: "The 32nd",
    icon: NotepadIcon,
  },
];

const BY_NAME: ExplorerSort = { key: "name", descending: false };

const TASK_GROUPS: ExplorerTaskGroup[] = [
  {
    title: "File and Folder Tasks",
    tasks: [
      { label: "Make a new folder", message: "That would be (4). Not yet." },
      { label: "Share this folder", message: "With who." },
    ],
  },
];

function NewFolderApp() {
  const { openApp } = useWindow();

  const handleOpenFile = (file: ExplorerFile) => {
    const { message } = file as FolderFile;
    if (message) return message;

    const args: NotepadArgs = { text: TEXT_FILE_CONTENT };
    openApp("asdf", { title: notepadTitle(TEXT_FILE_NAME), args });
  };

  return (
    <Explorer
      folderName="新增資料夾 (3)"
      files={FILES}
      taskGroups={TASK_GROUPS}
      defaultSort={BY_NAME}
      onOpenFile={handleOpenFile}
    />
  );
}

export default NewFolderApp;
