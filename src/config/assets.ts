import ANIMATION1 from "../assets/video/KiriSleep.webm";
import ANIMATION2 from "../assets/video/KiriRoll.webm";
import ANIMATION3 from "../assets/video/KiriOjousama.webm";
import ANIMATION4 from "../assets/video/KiriHeadspin.webm";
import ANIMATION5 from "../assets/video/KiriLook.webm";
import ANIMATION6 from "../assets/video/KiriIrisOut.webm";
import ANIMATION7 from "../assets/video/KiriPolishCow.webm";
import BGM1 from "../assets/bgm/Soul and Mind - E's Jammy Jams.mp3";
import BGM2 from "../assets/bgm/Rick Astley - Never Gonna Give You Up.mp3";
import BGM3 from "../assets/bgm/ASMRZ(TANAKA, NEEDMORECASH) - 잘자요 아가씨(prod. Gwana).mp3";
import BGM4 from "../assets/bgm/Bizzie - The Grand Affair.mp3";
import BGM5 from "../assets/bgm/Jane Street - TrackTribe.mp3";
import BGM6 from "../assets/bgm/米津玄師  Kenshi Yonezu - IRIS OUT.mp3";
import BGM7 from "../assets/bgm/Cypis - Gdzie jest biały węgorz (Zejście).mp3";

const videoMusicPairs = [
  { video: ANIMATION1, music: BGM1 },
  { video: ANIMATION2, music: BGM2 },
  { video: ANIMATION3, music: BGM3 },
  { video: ANIMATION4, music: BGM4 },
  { video: ANIMATION5, music: BGM5 },
  { video: ANIMATION6, music: BGM6 },
  { video: ANIMATION7, music: BGM7 },
];

export const getRandomPair = () => {
  const randomIndex = Math.floor(Math.random() * videoMusicPairs.length);
  return videoMusicPairs[randomIndex];
};