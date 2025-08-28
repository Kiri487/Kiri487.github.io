import { Helmet } from 'react-helmet-async';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';
import { FaCat, FaBook, FaMagic, FaStar } from "react-icons/fa";
import { SiCplusplus, SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact, SiGit } from "react-icons/si";
import { TbBrandCSharp } from "react-icons/tb";

function About() {
  return (
    <div className="about">
      <Helmet>
        <title>Kiri487 | About</title>
      </Helmet>
      <h2 className="title"><FaCat />whoami</h2>
      <div className="content">
        <p>Hi, I'm Kiri. I'm a first-year master's student at National Taiwan University Graduate Institute of Networking and Multimedia.<br />I'm interested in software development, web front-end design, and information security. Furthermore, I enjoy drawing and playing 3D models!<br />But I have no experience with 3D modeling yet—it's challenging QQ.</p>
      </div>
      <h2 className="title"><FaBook />Education</h2>
      <div className="content">
        <Timeline position="right">
          <TimelineItem>
            <TimelineOppositeContent style={{ maxWidth: "6rem", fontFamily: "'Oswald'", fontSize: "1.2rem" }} sx={{ m: "auto 0"}} align="left" color="white">
              2025-Now
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
              <TimelineDot sx={{ backgroundColor: "white", boxShadow: "none" }}></TimelineDot>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
            </TimelineSeparator>
            <TimelineContent style={{ fontFamily: "'Oswald'"}}>
              <p className="education-title">National Taiwan University (NTU)</p>
              <p className="education-info">Graduate Institute of Networking and Multimedia</p>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem>
            <TimelineOppositeContent style={{ maxWidth: "6rem", fontFamily: "'Oswald'", fontSize: "1.2rem" }} sx={{ m: "auto 0" }} align="left" color="white">
              2021-2025
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
              <TimelineDot variant="outlined" color="inherit"></TimelineDot>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
            </TimelineSeparator>
            <TimelineContent style={{ fontFamily: "'Oswald'"}}>
              <p className="education-title">National Taipei University of Technology (NTUT)</p>
              <p className="education-info">Electrical Engineering and Computer Science (Graduated)</p>
            </TimelineContent>
          </TimelineItem>
          <TimelineItem>
            <TimelineOppositeContent style={{ maxWidth: "6rem", fontFamily: "'Oswald'", fontSize: "1.2rem" }} sx={{ m: "auto 0" }} align="left" color="white">
              2019-2021
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
              <TimelineDot variant="outlined" color="inherit"></TimelineDot>
              <TimelineConnector sx={{ backgroundColor: "white" }}/>
            </TimelineSeparator>
            <TimelineContent style={{ fontFamily: "'Oswald'"}}>
              <p className="education-title">The Affiliated Senior High School of National Taiwan Normal University (HSNU)</p>
              <p className="education-info">Class 1489 (Graduated)</p>
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </div>
      <h2 className="title"><FaMagic />Skills</h2>
      <div className="content">
        <p className="subtitle">Language</p>
        <div className="tags">
          <div className="tag"><SiCplusplus />C++</div>
          <div className="tag"><TbBrandCSharp />C#</div>
          <div className="tag"><SiPython />Python</div>
          <div className="tag"><SiJavascript />JavaScript</div>
          <div className="tag"><SiTypescript />TypeScript</div>
        </div>
        <p className="subtitle">Front End</p>
        <div className="tags">
          <div className="tag"><SiHtml5 />HTML5</div>
          <div className="tag"><SiCss3 />CSS3</div>
          <div className="tag"><SiReact />React</div>
        </div>
        <p className="subtitle">Tools</p>
        <div className="tags">
          <div className="tag"><SiGit />Git</div>
        </div>
      </div>
      <h2 className="title"><FaStar />Experiences</h2>
      <div className="content">
        <p className="subtitle">Clubs</p>
        <ul className="experiences-content">
          <li>GDSC NTUT 2022-2023 Lead</li>
          <li>6th Vice President and Artistic Designer of NTUT Programming Club (NPC)</li>
          <li>41st Artistic Designer of HSNU Computer Research Club (CRC)</li>
        </ul>
        <p className="subtitle">Activities</p>
        <ul className="experiences-content">
          <li>Advanced Information Security - Summer School (AIS3) 2023 - Intelligence Utilization and Malware Analysis Group, Participant</li>
          <li>Students' Information Technology Conference (SITCON) 2022 - Staff</li>
        </ul>
        <p className="subtitle">Competition</p>
        <ul className="experiences-content">
          <li>Girls in CyberSecurity (GiCS) 2024 - Cybersecurity Challenge College/University Category, Finalist with Honorable Mention</li>
          <li>Girls in CyberSecurity (GiCS) 2023 - Cybersecurity Challenge College/University Category, Finalist with Honorable Mention</li>
        </ul>
      </div>
    </div>
  );
}

export default About;