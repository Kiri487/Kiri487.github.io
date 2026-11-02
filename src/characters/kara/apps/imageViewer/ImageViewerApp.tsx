import { useState } from "react";
import { BackIcon, BrokenImageIcon, ForwardIcon } from "../../icons";
import { useWindow } from "../../os/context";
import { viewerTitle, type ImageViewerArgs, type ViewerImage } from "./imageViewerArgs";
import "./imageViewer.css";

function Picture({ image }: { image: ViewerImage }) {
  const [failed, setFailed] = useState(false);
  const [clicked, setClicked] = useState(false);

  if (failed) {
    return (
      <div className="kara-viewer__missing">
        <BrokenImageIcon size={48} />
        <p>This picture has wandered off.</p>
      </div>
    );
  }
  const picture = (
    <img
      className="kara-viewer__image"
      src={clicked && image.clickedSrc ? image.clickedSrc : image.src}
      alt={image.name}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
  if (!image.clickedSrc) return picture;

  return (
    <button type="button" className="kara-viewer__clickable" aria-pressed={clicked} onClick={() => setClicked(!clicked)}>
      {picture}
      {/* Loaded in advance, so the first click answers right away. */}
      <img src={image.clickedSrc} alt="" hidden />
    </button>
  );
}

function ImageViewerApp() {
  const { args, openApp } = useWindow();
  const { images, index } = args as ImageViewerArgs;
  const image = images[index];

  const goTo = (next: number) => {
    const wrapped = (next + images.length) % images.length;
    openApp("imageViewer", { title: viewerTitle(images[wrapped].name), args: { images, index: wrapped } });
  };

  return (
    <div className="kara-viewer">
      <div className="kara-viewer__stage">
        {/* The key gives each picture its own failed state. */}
        <Picture key={image.src} image={image} />
      </div>
      <div className="kara-viewer__toolbar">
        <button type="button" className="kara-viewer__button" aria-label="Previous picture" onClick={() => goTo(index - 1)}>
          <BackIcon size={22} />
        </button>
        <button type="button" className="kara-viewer__button" aria-label="Next picture" onClick={() => goTo(index + 1)}>
          <ForwardIcon size={22} />
        </button>
        <span className="kara-viewer__position">
          {index + 1} / {images.length}
        </span>
        {image.url && (
          <a className="kara-viewer__link" href={image.url} target="_blank" rel="noreferrer">
            View original post
          </a>
        )}
      </div>
    </div>
  );
}

export default ImageViewerApp;
