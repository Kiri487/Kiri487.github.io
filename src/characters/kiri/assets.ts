export interface VideoBgmPair {
  webm: string;
  mov: string;
  /** The video's first frame, shown while the video loads. */
  poster: string;
  bgm: string;
}

export const videoBgmPairs: VideoBgmPair[] = [
  { webm: "/kiri/video/KiriSleep.webm", mov: "/kiri/video/KiriSleep_iOS.mov", poster: "/kiri/video/posters/KiriSleep.webp", bgm: "/kiri/bgm/Soul and Mind - E's Jammy Jams.mp3" },
  { webm: "/kiri/video/KiriRoll.webm", mov: "/kiri/video/KiriRoll_iOS.mov", poster: "/kiri/video/posters/KiriRoll.webp", bgm: "/kiri/bgm/Rick Astley - Never Gonna Give You Up.mp3" },
  { webm: "/kiri/video/KiriOjousama.webm", mov: "/kiri/video/KiriOjousama_iOS.mov", poster: "/kiri/video/posters/KiriOjousama.webp", bgm: "/kiri/bgm/ASMRZ(TANAKA, NEEDMORECASH) - 잘자요 아가씨(prod. Gwana).mp3" },
  { webm: "/kiri/video/KiriHeadspin.webm", mov: "/kiri/video/KiriHeadspin_iOS.mov", poster: "/kiri/video/posters/KiriHeadspin.webp", bgm: "/kiri/bgm/Bizzie - The Grand Affair.mp3" },
  { webm: "/kiri/video/KiriLook.webm", mov: "/kiri/video/KiriLook_iOS.mov", poster: "/kiri/video/posters/KiriLook.webp", bgm: "/kiri/bgm/Jane Street - TrackTribe.mp3" },
  { webm: "/kiri/video/KiriIrisOut.webm", mov: "/kiri/video/KiriIrisOut_iOS.mov", poster: "/kiri/video/posters/KiriIrisOut.webp", bgm: "/kiri/bgm/米津玄師  Kenshi Yonezu - IRIS OUT.mp3" },
  { webm: "/kiri/video/KiriPolishCow.webm", mov: "/kiri/video/KiriPolishCow_iOS.mov", poster: "/kiri/video/posters/KiriPolishCow.webp", bgm: "/kiri/bgm/Cypis - Gdzie jest biały węgorz (Zejście).mp3" },
];

export const getRandomIndex = () => Math.floor(Math.random() * videoBgmPairs.length);
