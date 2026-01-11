import { SiCplusplus, SiPython, SiJavascript, SiTypescript, SiPostgresql, SiHtml5, SiCss3, SiReact, SiGit, SiLinux } from "react-icons/si";
import { DiMsqlServer } from "react-icons/di";
import { TbBrandCSharp } from "react-icons/tb";
import { IconType } from "react-icons";

export interface Education {
  period: string;
  school: string;
  department: string;
}

export interface Work {
  period: string;
  company: string;
  position: string;
}

export interface Experience {
  category: string;
  items: string[];
}

export interface Skill {
  name: string;
  icon: IconType;
}

export const educationData: Education[] = [
  {
    period: "Aug 2025 - Present",
    school: "National Taiwan University (NTU)",
    department: "Graduate Institute of Networking and Multimedia (M.S.)"
  },
  {
    period: "Aug 2021 - Jun 2025",
    school: "National Taipei University of Technology (NTUT)",
    department: "Electrical Engineering and Computer Science (B.S.)",
  },
  {
    period: "Aug 2018 - Jun 2021",
    school: "The Affiliated Senior High School of National Taiwan Normal University (HSNU)",
    department: "Class 1489",
  }
];

export const workData: Work[] = [
  {
    period: "Jul 2024 - Jan 2025",
    company: "Galaxy Software Services Corporation (GSS)",
    position: "Software Engineer Intern"
  },
  {
    period: "Jul 2022 - Jun 2024",
    company: "NTUT Computer & Network Center",
    position: "IT Support Assistant"
  },
];

export const experienceData: Experience[] = [
  {
    category: "Honors & Awards",
    items: [
      "Girls in CyberSecurity (GiCS) 2025 - Cybersecurity Challenge College/University Category, Finalist with Excellence Award",
      "Girls in CyberSecurity (GiCS) 2024 - Cybersecurity Challenge College/University Category, Finalist with Honorable Mention",
      "Girls in CyberSecurity (GiCS) 2023 - Cybersecurity Challenge College/University Category, Finalist with Honorable Mention"
    ]
  },
  {
    category: "Certifications",
    items: [
      "Ministry of Economic Affairs (MOEA) iPAS - Information Security Engineer, Associate Level (Dec 2024)"
    ]
  },
  {
    category: "Clubs & Leadership",
    items: [
      "Google Developer Student Clubs (GDSC) NTUT - Lead (Aug 2022 - Jul 2023)",
      "NTUT Programming Club (NPC) - 6th Vice President and Artistic Designer (Aug 2022 - Jul 2023)",
      "HSNU Computer Research Club (CRC) - 41st Artistic Designer (Aug 2019 - Jul 2020)"
    ]
  },
  {
    category: "Community Involvement",
    items: [
      "Advanced Information Security - Summer School (AIS3) 2023 - Intelligence Utilization and Malware Analysis Group, Participant",
      "Students' Information Technology Conference (SITCON) 2022 - Staff"
    ]
  }
];

export const skillsData: { category: string; skills: Skill[] }[] = [
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
    category: "Database",
    skills: [
      { name: "MSSQL", icon: DiMsqlServer },
      { name: "PostgreSQL", icon: SiPostgresql },
    ]
  },
  {
    category: "Tools & OS",
    skills: [
      { name: "Git", icon: SiGit },
      { name: "Linux", icon: SiLinux },
    ]
  }
];