import doNotOpenClicked from "../../assets/do-not-open-clicked.webp";
import doNotOpen from "../../assets/do-not-open.webp";
import {
  BrokenImageIcon,
  BurgerIcon,
  ComputerIcon,
  FolderIcon,
  ImageFileIcon,
  NotepadIcon,
  PetFileIcon,
} from "../../icons";
import type { ExplorerSort, ExplorerTaskGroup } from "../explorer/types";
import { WORK_FILES } from "../works/workFiles";
import type { Folder, FolderFile, FolderId } from "./types";

const BY_NAME: ExplorerSort = { key: "name", descending: false };
const NEWEST_FIRST: ExplorerSort = { key: "date", descending: true };

const NEW_FOLDER_TASKS: ExplorerTaskGroup[] = [
  {
    title: "File and Folder Tasks",
    tasks: [
      { label: "Make a new folder", message: "That would be (4). Not yet." },
      { label: "Share this folder", message: "With who." },
    ],
  },
];

/** In the Recycle Bin only while she is, so it's added by the folder rather than listed below. */
export const PET_FILE: FolderFile = {
  id: "kara",
  name: "kara.cat",
  typeName: "Cat (probably)",
  date: "Just now, without asking",
  icon: PetFileIcon,
  action: { kind: "restorePet", message: "Restored. She'll remember this." },
};

/** Everything the folders contain lives here, so adding a file never touches an app. */
export const FOLDERS: Record<FolderId, Folder> = {
  works: {
    name: "stuff i made",
    files: WORK_FILES,
    defaultSort: NEWEST_FIRST,
    taskGroups: [
      {
        title: "Picture Tasks",
        tasks: [
          { label: "View as a slide show", message: "The slides have left the show." },
          { label: "Order prints online", message: "The printer is a rumor." },
        ],
      },
      {
        title: "File and Folder Tasks",
        tasks: [
          { label: "Rename everything properly", message: "Absolutely not." },
          { label: "Delete this folder", message: "You first." },
        ],
      },
    ],
  },
  newFolder: {
    name: "新增資料夾 (3)",
    defaultSort: BY_NAME,
    taskGroups: NEW_FOLDER_TASKS,
    files: [
      {
        id: "folder-1",
        name: "新增資料夾 (1) - Shortcut",
        typeName: "Shortcut",
        date: "Thursday (uninstalled)",
        icon: FolderIcon,
        action: { kind: "message", message: "This folder is safe." },
      },
      {
        id: "folder-2",
        name: "新增資料夾 (2) - Shortcut",
        typeName: "Shortcut",
        date: "Thursday (uninstalled)",
        icon: FolderIcon,
        action: { kind: "message", message: "This folder is safe from you specifically." },
      },
      {
        id: "folder-4",
        name: "新增資料夾 (4)",
        typeName: "File Folder",
        date: "Not yet",
        icon: FolderIcon,
        action: { kind: "message", message: "This one hasn't happened yet." },
      },
      {
        id: "not-a-folder",
        name: "not a folder",
        typeName: "Not a Folder",
        date: "The 32nd",
        icon: FolderIcon,
        action: { kind: "folder", folderId: "notAFolder" },
      },
      {
        id: "safe-from",
        name: "what they are safe from.txt",
        typeName: "Text Document",
        date: "The 32nd",
        icon: NotepadIcon,
        action: { kind: "text", text: ":3" },
      },
      {
        id: "eat-something",
        name: "eat_something.txt",
        typeName: "Text Document",
        date: "Today, after noon",
        icon: NotepadIcon,
        action: { kind: "text", text: "eat something" },
      },
    ],
  },
  notAFolder: {
    name: "not a folder",
    parent: "newFolder",
    // Text before pictures: the warning comes after the confession.
    defaultSort: { key: "type", descending: true },
    taskGroups: NEW_FOLDER_TASKS,
    files: [
      {
        id: "ok-its-a-folder",
        name: "ok it's a folder.txt",
        typeName: "Text Document",
        date: "The 32nd",
        icon: NotepadIcon,
        action: { kind: "text", text: "don't tell anyone" },
      },
      {
        // No thumbnail on purpose: the name is all the warning anyone gets.
        id: "do-not-open",
        name: "do not open.png",
        typeName: "PNG Image",
        date: "The 32nd",
        icon: ImageFileIcon,
        action: { kind: "image", src: doNotOpen, clickedSrc: doNotOpenClicked },
      },
    ],
  },
  games: {
    name: "games (do not tell kiri)",
    defaultSort: BY_NAME,
    taskGroups: [
      {
        title: "Game Tasks",
        tasks: [{ label: "Tell Kiri", message: "No." }],
      },
    ],
    files: [
      {
        id: "burger-sweeper",
        name: "burger sweeper.exe",
        typeName: "Application (no ads)",
        date: "Today, during work hours",
        icon: BurgerIcon,
        action: { kind: "app", appId: "burgerSweeper" },
      },
    ],
  },
  recycleBin: {
    name: "Recycle Bin",
    defaultSort: BY_NAME,
    taskGroups: [
      {
        title: "Recycle Bin Tasks",
        tasks: [
          { label: "Empty the Recycle Bin", message: "It said no." },
          { label: "Restore all items", message: "They know what they did." },
        ],
      },
    ],
    files: [
      {
        id: "burger",
        name: "chicken_burger.jpg",
        typeName: "Very Formal Burger",
        date: "Yesterday, probably",
        icon: ImageFileIcon,
        action: { kind: "message", message: "Restored. It came back warm.", restores: true },
      },
      {
        id: "thursday",
        name: "Thursday",
        typeName: "Day of the Week",
        date: "Thursday (uninstalled)",
        icon: BrokenImageIcon,
        action: {
          kind: "dynamicMessage",
          // Only on a real Thursday, which is the one day it's around to restore.
          resolve: () =>
            new Date().getDay() === 4
              ? { message: "It's back. Don't get used to it.", restores: true }
              : { message: "Thursday cannot be restored. Please stop asking.", restores: false },
        },
      },
      {
        id: "printer",
        name: "The Printer",
        typeName: "Rumor",
        date: "Friday, technically",
        icon: ComputerIcon,
        action: { kind: "message", message: "The Printer is in a meeting." },
      },
      {
        id: "chair",
        name: "chair position.bak",
        typeName: "Backup",
        date: "Monday (still)",
        icon: NotepadIcon,
        action: { kind: "message", message: "Restored. The room is unchanged." },
      },
      {
        id: "mr-spicy",
        name: "mr. spicy's old web",
        typeName: "Spider Property",
        date: "The 31st of February",
        icon: FolderIcon,
        action: { kind: "message", message: "Mr. Spicy would like this left where it is." },
      },
    ],
  },
};

/** The folder's place under C:\Kara, such as "新增資料夾 (3)\not a folder". */
export function folderPath(id: FolderId): string {
  const { name, parent } = FOLDERS[id];
  return parent ? `${folderPath(parent)}\\${name}` : name;
}
