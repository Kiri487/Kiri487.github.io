export interface ViewerImage {
  name: string;
  src: string;
  /** Where the picture was originally posted. Some on this computer were never posted anywhere. */
  url?: string;
  /** Clicking the picture switches to this one and back. */
  clickedSrc?: string;
}

export interface ImageViewerArgs {
  images: ViewerImage[];
  index: number;
}

export function viewerTitle(fileName: string): string {
  return `${fileName} - Kara Picture Viewer`;
}
