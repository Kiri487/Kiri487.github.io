import { FaCode } from "react-icons/fa";
// import { PiPawPrintFill } from "react-icons/pi";
import { SiCplusplus, SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact } from "react-icons/si";
import { TbBrandCSharp } from "react-icons/tb";
import { RiArrowRightDoubleLine } from "react-icons/ri";
import SIMPLE_PPT_IMG from "../assets/SimplePPT.png";
import DATA_VIS_IMG from "../assets/DataVis.png";
import CT_AND_CE_IMG from "../assets/ComputerTypographyAndCharacterEncoding.png";
import BOXBOB_IMG from "../assets/BoxBob.png";
import REDDIT_IMG from "../assets/RedditSentimentAnalysis.png";
import ELECOOKIES_IMG from "../assets/Elecookies.png";


function Portfolio() {
  return (
    <div className="portfolio">
      <h2 className="title"><FaCode />Projects</h2>
      <div className="content">
        <p className="subtitle">Personal</p>
        <div className="portfolio-block">
          <img src={SIMPLE_PPT_IMG} alt="Simple PowerPoint"/>
          <div className="portfolio-info">
            <p className="subtitle">Simple PowerPoint</p>
            <p>
              A software similar to PowerPoint but simpler, with its main features divided into four sections: menu, slide selection, drawing area, and graphical data display.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Kiri487/2023-Fall-Windows-PowerPoint">Github</a>
            </div>
            <div className="tags">
              <div className="tag"><TbBrandCSharp />C#</div>
            </div>
          </div>
        </div>
        <div className="portfolio-block">
          <img src={DATA_VIS_IMG} alt="Data Visualization Portfolio"/>
          <div className="portfolio-info">
            <p className="subtitle">Data Visualization Portfolio</p>
            <p>
              This portfolio features a series of projects developed as part of the "Data Visualization" course.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Kiri487/vis2023f">Github</a>&nbsp;&nbsp;<RiArrowRightDoubleLine /><a href="https://kiri487.github.io/vis2023f/hw00/index.html">Web Page</a>
            </div>
            <div className="tags">
              <div className="tag"><TbBrandCSharp />C#</div>
              <div className="tag"><SiJavascript />JavaScript</div>
              <div className="tag"><SiHtml5 />HTML5</div>
              <div className="tag"><SiCss3 />CSS3</div>
            </div>
          </div>
        </div>
        <div className="portfolio-block">
          <img src={CT_AND_CE_IMG} alt="Computer Typography and Character Encoding Portfolio"/>
          <div className="portfolio-info">
            <p className="subtitle">Computer Typography and Character Encoding Portfolio</p>
            <p>
              This portfolio features a series of projects developed as part of the "Computer Typography and Character Encoding" course.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Kiri487/ct2024s">Github</a>&nbsp;&nbsp;<RiArrowRightDoubleLine /><a href="https://kiri487.github.io/ct2024s/hw00/index.html">Web Page</a>
            </div>
            <div className="tags">
              <div className="tag"><SiJavascript />JavaScript</div>
              <div className="tag"><SiHtml5 />HTML5</div>
              <div className="tag"><SiCss3 />CSS3</div>
            </div>
          </div>
        </div>
        <div className="portfolio-block">
          {/* <img src={CA_IMG} alt="Computer Animation Portfolio"/> */}
          <div className="portfolio-info">
            <p className="subtitle">Computer Animation Portfolio</p>
            <p>
              This portfolio features a series of projects developed as part of the "Computer Animation" course.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Kiri487/ca2024f">Github</a>&nbsp;&nbsp;<RiArrowRightDoubleLine /><a href="https://kiri487.github.io/ca2024f/">Web Page</a>
            </div>
            <div className="tags">
              <div className="tag"><TbBrandCSharp />C#</div>
              <div className="tag"><SiJavascript />JavaScript</div>
              <div className="tag"><SiHtml5 />HTML5</div>
              <div className="tag"><SiCss3 />CSS3</div>
            </div>
          </div>
        </div>
        <p className="subtitle">Team</p>
        <div className="portfolio-block">
          <img src={BOXBOB_IMG} alt="BOXBOB"/>
          <div className="portfolio-info">
            <p className="subtitle">BOXBOB</p>
            <p>
              A simple and cute Sokoban game with 16 levels. The player can use up, down, left, right, and WASD to control the character. <br />
              It's a replica of the original game <a href="https://carlospedroso.itch.io/boxbob">BOXBOB</a> by Carlos Pedroso.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Kiri487/2022-Spring-OOPL/releases/tag/v1.0">Github</a>
            </div>
            <div className="tags">
              <div className="tag"><SiCplusplus />C++</div>
            </div>
          </div>
        </div>
        <div className="portfolio-block">
          <img src={REDDIT_IMG} alt="Reddit Sentiment Analysis"/>
          <div className="portfolio-info">
            <p className="subtitle">Reddit Sentiment Analysis</p>
            <p>
              The purpose of this project is to analyze user comments on various subreddits on <a href="https://www.reddit.com/">Reddit</a>  to determine the predominant emotional tendencies of the comments in each subreddit.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Kiri487/2024-Spring-NLP-Reddit-Sentiment-Analysis">Github</a>&nbsp;&nbsp;<RiArrowRightDoubleLine /><a href="https://kiri487.github.io/2024-Spring-NLP-Reddit-Sentiment-Analysis/">Web Page</a>
            </div>
            <div className="tags">
              <div className="tag"><SiPython />Python</div>
              <div className="tag"><SiJavascript />JavaScript</div>
              <div className="tag"><SiHtml5 />HTML5</div>
              <div className="tag"><SiCss3 />CSS3</div>
            </div>
          </div>
        </div>
        <div className="portfolio-block">
          <img src={ELECOOKIES_IMG} alt="Elecookies-Frontend"/>
          <div className="portfolio-info">
            <p className="subtitle">Elecookies-Frontend</p>
            <p>
              An online cookie store that offers features such as product management, user management, order management.
            </p>
            <div className="portfolio-links">
              <RiArrowRightDoubleLine /><a href="https://github.com/Zch720/NTUT_112_1_DatabaseProject_frontend">Github</a>
            </div>
            <div className="tags">
              <div className="tag"><SiTypescript />TypeScript</div>
              <div className="tag"><SiHtml5 />HTML5</div>
              <div className="tag"><SiCss3 />CSS3</div>
              <div className="tag"><SiReact />React</div>
            </div>
          </div>
        </div>
      </div>
      {/* <h2 className="title"><PiPawPrintFill />Creations</h2>
      <div className="content">
      </div> */}
    </div>
  );
}

export default Portfolio;