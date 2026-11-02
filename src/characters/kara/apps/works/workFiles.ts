import { worksData, type WorkItem } from "../../../../data/portfolio";
import { ImageFileIcon, LinkFileIcon, VideoFileIcon } from "../../icons";
import type { FolderFile } from "../folder/types";

function fileKind(work: WorkItem) {
  if (work.icon === "link") return { extension: "lnk", typeName: "Shortcut", icon: LinkFileIcon };
  if (work.type === "video") return { extension: "mp4", typeName: "MP4 Video", icon: VideoFileIcon };
  if (work.thumbnail.includes("format=png")) return { extension: "png", typeName: "PNG Image", icon: ImageFileIcon };
  return { extension: "jpg", typeName: "JPEG Image", icon: ImageFileIcon };
}

/** The characters Windows refuses in a file name. "My OC: Kassus" becomes "My OC - Kassus". */
function toFileStem(title: string): string {
  return title.replace(/\s*:\s*/g, " - ").replace(/[\\/*?"<>|]/g, "").trim();
}

function buildWorkFiles(): FolderFile[] {
  const timesUsed = new Map<string, number>();

  // Oldest first, so posting a new "Doodle" takes the next number and never renames the old ones.
  return [...worksData].reverse().map((work, index) => {
    const { extension, typeName, icon } = fileKind(work);
    const stem = toFileStem(work.title);
    const count = (timesUsed.get(stem) ?? 0) + 1;
    timesUsed.set(stem, count);

    return {
      id: `work-${index}`,
      name: count === 1 ? `${stem}.${extension}` : `${stem} (${count}).${extension}`,
      typeName,
      date: work.date,
      icon,
      thumbnail: work.thumbnail,
      // Pictures open in the viewer, everything else leaves. The data holds X's small preview, and the viewer has room for the large one.
      action:
        icon === ImageFileIcon
          ? { kind: "image", src: work.thumbnail.replace("name=small", "name=large"), url: work.url }
          : { kind: "link", url: work.url },
    };
  });
}

export const WORK_FILES = buildWorkFiles();
