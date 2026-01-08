import { SiCplusplus, SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact } from "react-icons/si";
import { TbBrandCSharp } from "react-icons/tb";
import { IconType } from "react-icons";

import SIMPLE_PPT_IMG from "../assets/img/SimplePPT.png";
import DATA_VIS_IMG from "../assets/img/DataVis.png";
import CT_AND_CE_IMG from "../assets/img/ComputerTypographyAndCharacterEncoding.png";
import CA_IMG from "../assets/img/ComputerAnimation.png";
import BOXBOB_IMG from "../assets/img/BoxBob.png";
import REDDIT_IMG from "../assets/img/RedditSentimentAnalysis.png";
import ELECOOKIES_IMG from "../assets/img/Elecookies.png";
import AI_KASSUS_IMG from "../assets/img/AiKassus.png";
import MYSTIC_SHOP_IMG from "../assets/img/MysticShopLUIS.png";
import GRAVITY_DRIFT_IMG from "../assets/img/GravityDrift.png";

export interface ProjectLink {
  label: string;
  url: string;
}

export interface ProjectTag {
  icon: IconType;
  name: string;
}

export interface Project {
  title: string;
  img: string;
  year: string;
  description: React.ReactNode;
  links: ProjectLink[];
  tags: ProjectTag[];
}

export const personalProjects: Project[] = [
  {
    title: "Mystic Shop LUIS",
    img: MYSTIC_SHOP_IMG,
    year: "2025",
    description: "A cute puzzle game and playable in the browser.",
    links: [
      { label: "Play", url: "https://kiri487.itch.io/mystic-shop-luis" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
    ]
  },
  {
    title: "AI Vtuber - Kassus",
    img: AI_KASSUS_IMG,
    year: "2025",
    description: "An AI-powered Virtual YouTuber. It integrates Large Language Models (LLM) to enable real-time, interactive conversations with the audience.",
    links: [
      { label: "Demo VOD", url: "https://youtube.com/live/qfJ_Ch7Z-wM" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
    ]
  },
  {
    title: "Computer Animation Projects",
    img: CA_IMG,
    year: "2024",
    description: "This projects features a series of projects developed as part of the \"Computer Animation\" course.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/ca2024f" },
      { label: "View", url: "https://kiri487.github.io/ca2024f/" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Computer Typography and Character Encoding Projects",
    img: CT_AND_CE_IMG,
    year: "2024",
    description: "This projects features a series of projects developed as part of the \"Computer Typography and Character Encoding\" course.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/ct2024s" },
      { label: "View", url: "https://kiri487.github.io/ct2024s/hw00/index.html" }
    ],
    tags: [
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Data Visualization Projects",
    img: DATA_VIS_IMG,
    year: "2023",
    description: "This projects features a series of projects developed as part of the \"Data Visualization\" course.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/vis2023f" },
      { label: "View", url: "https://kiri487.github.io/vis2023f/hw00/index.html" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Simple PowerPoint",
    img: SIMPLE_PPT_IMG,
    year: "2023",
    description: "A software similar to PowerPoint but simpler, with its main features divided into four sections: menu, slide selection, drawing area, and graphical data display.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/2023-Fall-Windows-PowerPoint" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" }
    ]
  }
];

export const teamProjects: Project[] = [
  {
    title: "Gravity Drift",
    img: GRAVITY_DRIFT_IMG,
    year: "2025",
    description: "A cute puzzle game and playable in the browser.",
    links: [
      { label: "Play", url: "https://tofudoctorr.itch.io/gravitydrift" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
    ]
  },
  {
    title: "Reddit Sentiment Analysis",
    img: REDDIT_IMG,
    year: "2024",
    description: (
      <>
        The purpose of this project is to analyze user comments on various subreddits on <a href="https://www.reddit.com/">Reddit</a> to determine the predominant emotional tendencies of the comments in each subreddit.
      </>
    ),
    links: [
      { label: "Github", url: "https://github.com/Kiri487/2024-Spring-NLP-Reddit-Sentiment-Analysis" },
      { label: "View", url: "https://kiri487.github.io/2024-Spring-NLP-Reddit-Sentiment-Analysis/" }
    ],
    tags: [
      { icon: SiPython, name: "Python" },
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Elecookies-Frontend",
    img: ELECOOKIES_IMG,
    year: "2023",
    description: "An online cookie store that offers features such as product management, user management, order management.",
    links: [
      { label: "Github", url: "https://github.com/Zch720/NTUT_112_1_DatabaseProject_frontend" }
    ],
    tags: [
      { icon: SiTypescript, name: "TypeScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" },
      { icon: SiReact, name: "React" }
    ]
  },
  {
    title: "BOXBOB",
    img: BOXBOB_IMG,
    year: "2022",
    description: (
      <>
        A simple and cute Sokoban game with 16 levels. The player can use up, down, left, right, and WASD to control the character. <br />
        It's a replica of the original game <a href="https://carlospedroso.itch.io/boxbob">BOXBOB</a> by Carlos Pedroso.
      </>
    ),
    links: [
      { label: "Github", url: "https://github.com/Kiri487/2022-Spring-OOPL/releases/tag/v1.0" }
    ],
    tags: [
      { icon: SiCplusplus, name: "C++" }
    ]
  }
];