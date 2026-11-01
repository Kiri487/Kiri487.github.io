import { useWindow } from "../../os/context";
import Explorer from "../explorer/Explorer";
import type { ExplorerFile, ExplorerSort, ExplorerTaskGroup } from "../explorer/types";
import { viewerTitle, type ImageViewerArgs, type ViewerImage } from "../imageViewer/imageViewerArgs";
import { WORK_FILES, type WorkFile } from "./workFiles";

const NEWEST_FIRST: ExplorerSort = { key: "date", descending: true };

const TASK_GROUPS: ExplorerTaskGroup[] = [
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
];

function WorksApp() {
  const { openApp } = useWindow();

  const handleOpenFile = (file: ExplorerFile, ordered: ExplorerFile[]) => {
    const work = file as WorkFile;
    if (!work.fullImage) {
      window.open(work.url, "_blank", "noopener,noreferrer");
      return;
    }

    const images: ViewerImage[] = (ordered as WorkFile[]).flatMap((candidate) =>
      candidate.fullImage ? [{ name: candidate.name, src: candidate.fullImage, url: candidate.url }] : [],
    );
    const index = images.findIndex((image) => image.src === work.fullImage);
    const args: ImageViewerArgs = { images, index };
    openApp("imageViewer", { title: viewerTitle(images[index].name), args });
  };

  return (
    <Explorer
      folderName="stuff i made"
      files={WORK_FILES}
      taskGroups={TASK_GROUPS}
      defaultSort={NEWEST_FIRST}
      onOpenFile={handleOpenFile}
    />
  );
}

export default WorksApp;
