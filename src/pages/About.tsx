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
import { IconType } from "react-icons";

interface Education {
  period: string;
  school: string;
  department: string;
  status?: string;
}

interface Skill {
  name: string;
  icon: IconType;
}

interface ExperienceSection {
  category: string;
  items: string[];
}

const educationData: Education[] = [
  {
    period: "2025-Now",
    school: "National Taiwan University (NTU)",
    department: "Graduate Institute of Networking and Multimedia"
  },
  {
    period: "2021-2025",
    school: "National Taipei University of Technology (NTUT)",
    department: "Electrical Engineering and Computer Science",
    status: "Graduated"
  },
  {
    period: "2019-2021",
    school: "The Affiliated Senior High School of National Taiwan Normal University (HSNU)",
    department: "Class 1489",
    status: "Graduated"
  }
];

const skillsData: { category: string; skills: Skill[] }[] = [
  {
    category: "Language",
    skills: [
      { name: "C++", icon: SiCplusplus },
      { name: "C#", icon: TbBrandCSharp },
      { name: "Python", icon: SiPython },
      { name: "JavaScript", icon: SiJavascript },
      { name: "TypeScript", icon: SiTypescript },
    ]
  },
  {
    category: "Front End",
    skills: [
      { name: "HTML5", icon: SiHtml5 },
      { name: "CSS3", icon: SiCss3 },
      { name: "React", icon: SiReact },
    ]
  },
  {
    category: "Tools",
    skills: [
      { name: "Git", icon: SiGit },
    ]
  }
];

const experienceData: ExperienceSection[] = [
  {
    category: "Clubs",
    items: [
      "GDSC NTUT 2022-2023 Lead",
      "6th Vice President and Artistic Designer of NTUT Programming Club (NPC)",
      "41st Artistic Designer of HSNU Computer Research Club (CRC)"
    ]
  },
  {
    category: "Activities",
    items: [
      "Advanced Information Security - Summer School (AIS3) 2023 - Intelligence Utilization and Malware Analysis Group, Participant",
      "Students' Information Technology Conference (SITCON) 2022 - Staff"
    ]
  },
  {
    category: "Competition",
    items: [
      "Girls in CyberSecurity (GiCS) 2024 - Cybersecurity Challenge College/University Category, Finalist with Honorable Mention",
      "Girls in CyberSecurity (GiCS) 2023 - Cybersecurity Challenge College/University Category, Finalist with Honorable Mention"
    ]
  }
];

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
          {educationData.map((edu, index) => (
            <TimelineItem key={index}>
              <TimelineOppositeContent style={{ maxWidth: "6rem", fontFamily: "'Oswald'", fontSize: "1.2rem" }} sx={{ m: "auto 0" }} align="left" color="white">
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
              <TimelineContent style={{ fontFamily: "'Oswald'" }}>
                <p className="education-title">{edu.school}</p>
                <p className="education-info">
                  {edu.department} {edu.status && `(${edu.status})`}
                </p>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </div>

      <h2 className="title"><FaMagic />Skills</h2>
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

      <h2 className="title"><FaStar />Experiences</h2>
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