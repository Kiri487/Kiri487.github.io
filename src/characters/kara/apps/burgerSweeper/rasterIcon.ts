import { useEffect, useState } from "react";

/**
 * Fluent's emoji are detailed SVGs, and drawing hundreds of them at once is slow: losing a big board shows every
 * burger, and dragging its window redraws them all. So each is drawn once into a picture, which every cell then
 * shares, as cheap to show a thousand times as once. Big enough for the largest cell on a sharp screen.
 */
const RASTER_SIZE = 128;

const done = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function rasterize(src: string): Promise<string> {
  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = RASTER_SIZE;
      canvas.height = RASTER_SIZE;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(src);
        return;
      }
      context.drawImage(image, 0, 0, RASTER_SIZE, RASTER_SIZE);
      const url = canvas.toDataURL("image/png");
      done.set(src, url);
      resolve(url);
    };
    // Something went wrong: the SVG itself still works, only slower.
    image.onerror = () => resolve(src);
    image.src = src;
  });
  pending.set(src, promise);
  return promise;
}

/** The picture made from this SVG, or the SVG itself until the picture is ready. */
export function useRasterIcon(src: string): string {
  const [url, setUrl] = useState(() => done.get(src) ?? src);

  useEffect(() => {
    if (done.has(src)) return;
    let current = true;
    rasterize(src).then((result) => {
      if (current) setUrl(result);
    });
    return () => {
      current = false;
    };
  }, [src]);

  return url;
}
