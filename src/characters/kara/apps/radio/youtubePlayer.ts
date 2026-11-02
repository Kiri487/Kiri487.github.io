/** Only the parts of the YouTube IFrame Player API the radio uses. */
export interface YouTubePlayer {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

export interface YouTubePlayerOptions {
  width: string;
  height: string;
  videoId: string;
  playerVars: Record<string, string | number>;
  events: {
    /** The player's methods only exist from here on, so `target` is the first safe reference to it. */
    onReady: (event: { target: YouTubePlayer }) => void;
    onStateChange: (event: { data: number }) => void;
    onError: (event: { data: number }) => void;
    onAutoplayBlocked: () => void;
  };
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

/** The API's first script loads a second one, and a block on that one would otherwise never report back. */
const API_TIMEOUT_MS = 15000;

let apiPromise: Promise<YouTubeApi> | null = null;

/** Downloads the API once, the first time a radio opens. A failure clears the way for the next attempt. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  apiPromise ??= new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");

    const fail = (message: string) => {
      window.clearTimeout(timeout);
      script.remove();
      // The first script leaves this behind, and seeing it makes the next attempt skip loading the second one.
      delete window.YT;
      apiPromise = null;
      reject(new Error(message));
    };
    const timeout = window.setTimeout(() => fail("The YouTube API took too long to load."), API_TIMEOUT_MS);

    window.onYouTubeIframeAPIReady = () => {
      if (!window.YT) {
        fail("The YouTube API loaded without its player.");
        return;
      }
      window.clearTimeout(timeout);
      resolve(window.YT);
    };

    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => fail("The YouTube API could not be downloaded.");
    document.head.appendChild(script);
  });
  return apiPromise;
}
