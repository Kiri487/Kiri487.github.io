/** Only the parts of the YouTube IFrame Player API the radio uses. */
export interface YouTubePlayer {
  cueVideoById: (videoId: string) => void;
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
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onError: () => void;
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

let apiPromise: Promise<YouTubeApi> | null = null;

/** Downloads the API once, the first time a radio opens. A failure clears the way for the next attempt. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  apiPromise ??= new Promise<YouTubeApi>((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT) resolve(window.YT);
      else reject(new Error("The YouTube API loaded without its player."));
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      script.remove();
      apiPromise = null;
      reject(new Error("The YouTube API could not be downloaded."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
