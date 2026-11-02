import type { OsActions } from "../../os/context";
import { openExternal } from "../common/openExternal";
import { viewerTitle, type ImageViewerArgs, type ViewerImage } from "../imageViewer/imageViewerArgs";
import { notepadTitle, type NotepadArgs } from "../notepad/documents";
import type { FolderFile, FolderId } from "./types";

interface OpenFileContext {
  /** The folder as currently sorted, so the viewer can step through it in the same order. */
  ordered: FolderFile[];
  openApp: OsActions["openApp"];
  goToFolder: (id: FolderId) => void;
  restore: (fileId: string) => void;
}

/** Does what the file says. A returned string belongs in the folder's message box. */
export function openFile(file: FolderFile, context: OpenFileContext): string | void {
  const { action } = file;

  switch (action.kind) {
    case "text": {
      const args: NotepadArgs = { text: action.text };
      context.openApp("notepad", { instanceKey: file.id, title: notepadTitle(file.name), args });
      return;
    }
    case "image": {
      const images: ViewerImage[] = context.ordered.flatMap(({ name, action: candidate }) =>
        candidate.kind === "image"
          ? [{ name, src: candidate.src, url: candidate.url, clickedSrc: candidate.clickedSrc }]
          : [],
      );
      const args: ImageViewerArgs = { images, index: images.findIndex((image) => image.src === action.src) };
      context.openApp("imageViewer", { title: viewerTitle(file.name), args });
      return;
    }
    case "link":
      openExternal(action.url);
      return;
    case "folder":
      context.goToFolder(action.folderId);
      return;
    case "message":
      if (action.restores) context.restore(file.id);
      return action.message;
    case "dynamicMessage": {
      const { message, restores } = action.resolve();
      if (restores) context.restore(file.id);
      return message;
    }
  }
}
