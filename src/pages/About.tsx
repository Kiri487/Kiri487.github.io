import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';
import { FaCat, FaBook, FaMagic, FaStar} from "react-icons/fa";
import { SiCplusplus, SiCsharp, SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact, SiGit } from "react-icons/si";

function About() {
  return (
    <div className="about">
      <h2 className="about-title"><FaCat />whoami</h2>
      <div className="about-content">
        <p>Hi, I'm Kiri. I'm a senior majoring in Electrical Engineering and Computer Science at the National Taipei University of Technology (NTUT).<br />I'm interested in software development, web front-end design, and information security. Furthermore, I enjoy drawing and playing 3D models! But I have no experience with 3D modeling yet—it's challenging QQ.</p>
      </div>
      <h2 className="about-title"><FaBook />Education</h2>
      <div className="about-content">
        <Timeline position="right">
          <TimelineItem>
            <TimelineOppositeContent style={{ flex: 0.1, fontFamily: "'Oswald'", fontSize: "1.2rem" }} sx={{ m: "auto 0"}} align="left" color="white">
              2021-Now
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
              <TimelineDot sx={{ backgroundColor: "white" }}></TimelineDot>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
            </TimelineSeparator>
            <TimelineContent style={{ fontFamily: "'Oswald'"}}>
              <p className="education-title">National Taipei University of Technology (NTUT)</p>
              <p className="education-info">Electrical Engineering and Computer Science</p>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem>
            <TimelineOppositeContent style={{ flex: 0.1, fontFamily: "'Oswald'", fontSize: "1.2rem" }} sx={{ m: "auto 0" }} align="left" color="white">
              <p>2019-2021</p> 
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
              <TimelineDot variant="outlined" color="inherit"></TimelineDot>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
            </TimelineSeparator>
            <TimelineContent style={{ fontFamily: "'Oswald'"}}>
              <p className="education-title">The Affiliated Senior High School of National Taiwan Normal University (HSNU)</p>
              <p className="education-info">High School (Graduated)</p>
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </div>
      <h2 className="about-title"><FaMagic />Skills</h2>
      <div className="about-content">
        <p className="about-subtitle">Language</p>
        <div className="skills-content">
          <div className="skills-tag">
            <SiCplusplus />C++
          </div>
          <div className="skills-tag">
            <SiCsharp />C#
          </div>
          <div className="skills-tag">
            <SiPython />Python
          </div>
          <div className="skills-tag">
            <SiJavascript />JavaScript
          </div>
          <div className="skills-tag">
            <SiTypescript />TypeScript
          </div>
        </div>
        <p className="about-subtitle">Front End</p>
        <div className="skills-content">
          <div className="skills-tag">
            <SiHtml5 />HTML5
          </div>
          <div className="skills-tag">
            <SiCss3 />CSS3
          </div>
          <div className="skills-tag">
            <SiReact />React
          </div>
        </div>
        <p className="about-subtitle">Tools</p>
        <div className="skills-content">
          <div className="skills-tag">
            <SiGit />Git
          </div>
        </div>
      </div>
      <h2 className="about-title"><FaStar />Experiences</h2>
      <div className="about-content">
      <p className="about-subtitle">Clubs</p>
        <ul>
          <li>GDSC NTUT 2022-2023 Lead</li>
          <li>6th Vice President and Design Officer of NTUT Programming Club (NPC)</li>
          <li>41st Design Officer of HSNU Computer Research Club (CRC)</li>
        </ul>
      </div>
    </div>
  );
}

export default About;