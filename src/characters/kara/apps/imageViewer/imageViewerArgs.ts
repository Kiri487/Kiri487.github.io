export interface ViewerImage {
  name: string;
  src: string;
  /** Where the picture was originally posted. */
  url: string;
}

export interface ImageViewerArgs {
  images: ViewerImage[];
  index: number;
}

export function viewerTitle(fileName: string): string {
  return `${fileName} - Kara Picture Viewer`;
}
