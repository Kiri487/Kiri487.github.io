import type { ExplorerFile, ExplorerSort, ExplorerTaskGroup } from "../explorer/types";

export type FolderId = "works" | "newFolder" | "notAFolder" | "recycleBin";

/** What double-clicking a file does. */
export type FileAction =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; /** Where the picture was originally posted. */ url: string }
  | { kind: "link"; url: string }
  | { kind: "folder"; folderId: FolderId }
  /** `restores` also takes the file out of its folder until the window closes. */
  | { kind: "message"; message: string; restores?: boolean };

export interface FolderFile extends ExplorerFile {
  action: FileAction;
}

export interface Folder {
  name: string;
  /** Leave out for a folder at the top, which Up refuses to leave. */
  parent?: FolderId;
  files: FolderFile[];
  taskGroups: ExplorerTaskGroup[];
  defaultSort: ExplorerSort;
}

export interface FolderArgs {
  folderId: FolderId;
}
