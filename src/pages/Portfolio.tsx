import { Helmet } from 'react-helmet-async';
import { FaCode } from "react-icons/fa";
import { SiCplusplus, SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact } from "react-icons/si";
import { TbBrandCSharp } from "react-icons/tb";
import { RiArrowRightDoubleLine } from "react-icons/ri";
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

interface ProjectLink {
  label: string;
  url: string;
}

interface ProjectTag {
  icon: IconType;
  name: string;
}

interface Project {
  title: string;
  img: string;
  description: React.ReactNode;
  links: ProjectLink[];
  tags: ProjectTag[];
}

const personalProjects: Project[] = [
  {
    title: "Mystic Shop LUIS (2025)",
    img: MYSTIC_SHOP_IMG,
    description: "A cute puzzle game and playable in the browser.",
    links: [
      { label: "itch.io Page", url: "https://kiri487.itch.io/mystic-shop-luis" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
    ]
  },
  {
    title: "AI Vtuber - Kassus (2025)",
    img: AI_KASSUS_IMG,
    description: "An AI-powered Virtual YouTuber. It integrates Large Language Models (LLM) to enable real-time, interactive conversations with the audience.",
    links: [
      { label: "Demo VOD", url: "https://youtube.com/live/qfJ_Ch7Z-wM" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
    ]
  },
  {
    title: "Computer Animation Portfolio (2024)",
    img: CA_IMG,
    description: "This portfolio features a series of projects developed as part of the \"Computer Animation\" course.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/ca2024f" },
      { label: "Web Page", url: "https://kiri487.github.io/ca2024f/" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Computer Typography and Character Encoding Portfolio (2024)",
    img: CT_AND_CE_IMG,
    description: "This portfolio features a series of projects developed as part of the \"Computer Typography and Character Encoding\" course.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/ct2024s" },
      { label: "Web Page", url: "https://kiri487.github.io/ct2024s/hw00/index.html" }
    ],
    tags: [
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Data Visualization Portfolio (2023)",
    img: DATA_VIS_IMG,
    description: "This portfolio features a series of projects developed as part of the \"Data Visualization\" course.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/vis2023f" },
      { label: "Web Page", url: "https://kiri487.github.io/vis2023f/hw00/index.html" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Simple PowerPoint (2023)",
    img: SIMPLE_PPT_IMG,
    description: "A software similar to PowerPoint but simpler, with its main features divided into four sections: menu, slide selection, drawing area, and graphical data display.",
    links: [
      { label: "Github", url: "https://github.com/Kiri487/2023-Fall-Windows-PowerPoint" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" }
    ]
  }
];

const teamProjects: Project[] = [
  {
    title: "Gravity Drift (2025)",
    img: GRAVITY_DRIFT_IMG,
    description: "A cute puzzle game and playable in the browser.",
    links: [
      { label: "itch.io Page", url: "https://tofudoctorr.itch.io/gravitydrift" }
    ],
    tags: [
      { icon: TbBrandCSharp, name: "C#" },
    ]
  },
  {
    title: "Reddit Sentiment Analysis (2024)",
    img: REDDIT_IMG,
    description: (
      <>
        The purpose of this project is to analyze user comments on various subreddits on <a href="https://www.reddit.com/">Reddit</a> to determine the predominant emotional tendencies of the comments in each subreddit.
      </>
    ),
    links: [
      { label: "Github", url: "https://github.com/Kiri487/2024-Spring-NLP-Reddit-Sentiment-Analysis" },
      { label: "Web Page", url: "https://kiri487.github.io/2024-Spring-NLP-Reddit-Sentiment-Analysis/" }
    ],
    tags: [
      { icon: SiPython, name: "Python" },
      { icon: SiJavascript, name: "JavaScript" },
      { icon: SiHtml5, name: "HTML5" },
      { icon: SiCss3, name: "CSS3" }
    ]
  },
  {
    title: "Elecookies-Frontend (2023)",
    img: ELECOOKIES_IMG,
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
    title: "BOXBOB (2022)",
    img: BOXBOB_IMG,
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

const ProjectCard = ({ project }: { project: Project }) => {
  return (
    <div className="portfolio-block">
      <img src={project.img} alt={project.title} />
      <div className="portfolio-info">
        <p className="subtitle">{project.title}</p>
        <p>{project.description}</p>
        
        <div className="portfolio-links">
          {project.links.map((link, index) => (
            <span key={index} style={{ display: 'inline-flex', alignItems: 'center', marginRight: index < project.links.length - 1 ? '1rem' : 0 }}>
              <RiArrowRightDoubleLine />
              <a href={link.url}>{link.label}</a>
            </span>
          ))}
        </div>

        <div className="tags">
          {project.tags.map((tag, index) => (
            <div className="tag" key={index}>
              <tag.icon />{tag.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function Portfolio() {
  return (
    <div className="portfolio">
      <Helmet>
        <title>Kiri487 | Portfolio</title>
      </Helmet>
      
      <h2 className="title"><FaCode />Projects</h2>
      
      <div className="content">
        <p className="subtitle">Personal</p>
        {personalProjects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}

        <p className="subtitle">Team</p>
        {teamProjects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
      </div>

      {/* <h2 className="title"><PiPawPrintFill />Creations</h2>
      <div className="content">
      </div> */}
    </div>
  );
}

export default Portfolio;