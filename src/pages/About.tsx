import { Helmet } from 'react-helmet-async';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';
import { FaCat, FaBook, FaMagic, FaStar } from "react-icons/fa";
import { educationData, skillsData, experienceData } from "../data/about";

function About() {
  return (
    <div className="about">
      <Helmet>
        <title>Kiri487 | About</title>
      </Helmet>

      <h2 className="title"><FaCat aria-hidden="true"/>whoami</h2>
      <div className="content">
        <p>Hi, I'm Kiri. I'm a first-year master's student at National Taiwan University Graduate Institute of Networking and Multimedia.<br />I'm interested in software development, web front-end design, and information security. Furthermore, I enjoy drawing and playing 3D models!<br />But I have no experience with 3D modeling yet—it's challenging QQ.</p>
      </div>

      <h2 className="title"><FaBook aria-hidden="true"/>Education</h2>
      <div className="content">
        <Timeline position="right">
          {educationData.map((edu, index) => (
            <TimelineItem key={index}>
              <TimelineOppositeContent sx={{ maxWidth: "6rem", fontFamily: "'Oswald'", fontSize: "1.2rem", m: "auto 0" }} align="left" color="white">
                {edu.period}
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineConnector sx={{ backgroundColor: "white" }} />
                <TimelineDot 
                  variant={index === 0 ? "filled" : "outlined"} 
                  color="inherit" 
                  sx={{ backgroundColor: index === 0 ? "white" : "transparent", boxShadow: "none" }} 
                />
                <TimelineConnector sx={{ backgroundColor: "white" }} />
              </TimelineSeparator>
              <TimelineContent sx={{ fontFamily: "'Oswald'" }}>
                <p className="education-title">{edu.school}</p>
                <p className="education-info">
                  {edu.department} {edu.status && `(${edu.status})`}
                </p>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </div>

      <h2 className="title"><FaMagic aria-hidden="true"/>Skills</h2>
      <div className="content">
        {skillsData.map((section, index) => (
          <div key={index}>
            <p className="subtitle">{section.category}</p>
            <div className="tags">
              {section.skills.map((skill, i) => (
                <div className="tag" key={i}>
                  <skill.icon />{skill.name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="title"><FaStar aria-hidden="true"/>Experiences</h2>
      <div className="content">
        {experienceData.map((exp, index) => (
          <div key={index}>
            <p className="subtitle">{exp.category}</p>
            <ul className="experiences-content">
              {exp.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default About;