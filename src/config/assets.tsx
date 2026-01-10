import WEBM1 from "../assets/video/KiriSleep.webm";
import WEBM2 from "../assets/video/KiriRoll.webm";
import WEBM3 from "../assets/video/KiriOjousama.webm";
import WEBM4 from "../assets/video/KiriHeadspin.webm";
import WEBM5 from "../assets/video/KiriLook.webm";
import WEBM6 from "../assets/video/KiriIrisOut.webm";
import WEBM7 from "../assets/video/KiriPolishCow.webm";

import MOV1 from "../assets/video/KiriSleep_iOS.mov";
import MOV2 from "../assets/video/KiriRoll_iOS.mov";
import MOV3 from "../assets/video/KiriOjousama_iOS.mov";
import MOV4 from "../assets/video/KiriHeadspin_iOS.mov";
import MOV5 from "../assets/video/KiriLook_iOS.mov";
import MOV6 from "../assets/video/KiriIrisOut_iOS.mov";
import MOV7 from "../assets/video/KiriPolishCow_iOS.mov";

import BGM1 from "../assets/bgm/Soul and Mind - E's Jammy Jams.mp3";
import BGM2 from "../assets/bgm/Rick Astley - Never Gonna Give You Up.mp3";
import BGM3 from "../assets/bgm/ASMRZ(TANAKA, NEEDMORECASH) - 잘자요 아가씨(prod. Gwana).mp3";
import BGM4 from "../assets/bgm/Bizzie - The Grand Affair.mp3";
import BGM5 from "../assets/bgm/Jane Street - TrackTribe.mp3";
import BGM6 from "../assets/bgm/米津玄師  Kenshi Yonezu - IRIS OUT.mp3";
import BGM7 from "../assets/bgm/Cypis - Gdzie jest biały węgorz (Zejście).mp3";

export interface VideoBgmPair {
  webm: string;
  mov: string;
  bgm: string;
}

export const videoBgmPairs: VideoBgmPair[] = [
  { webm: WEBM1, mov: MOV1, bgm: BGM1 },
  { webm: WEBM2, mov: MOV2, bgm: BGM2 },
  { webm: WEBM3, mov: MOV3, bgm: BGM3 },
  { webm: WEBM4, mov: MOV4, bgm: BGM4 },
  { webm: WEBM5, mov: MOV5, bgm: BGM5 },
  { webm: WEBM6, mov: MOV6, bgm: BGM6 },
  { webm: WEBM7, mov: MOV7, bgm: BGM7 },
];

export const getRandomIndex = () => Math.floor(Math.random() * videoBgmPairs.length);