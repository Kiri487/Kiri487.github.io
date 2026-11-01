import { worksData, type WorkItem } from "../../../../data/portfolio";
import { ImageFileIcon, LinkFileIcon, VideoFileIcon } from "../../icons";
import type { ExplorerFile } from "../explorer/types";

export interface WorkFile extends ExplorerFile {
  /** Set for pictures, which open in the viewer. Everything else leaves for `url`. */
  fullImage?: string;
  url: string;
}

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

function buildWorkFiles(): WorkFile[] {
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
      url: work.url,
      // The data holds X's small preview. The viewer has room for the large one.
      fullImage: icon === ImageFileIcon ? work.thumbnail.replace("name=small", "name=large") : undefined,
    };
  });
}

export const WORK_FILES = buildWorkFiles();
