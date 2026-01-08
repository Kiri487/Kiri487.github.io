import { SiCplusplus, SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact, SiGit } from "react-icons/si";
import { TbBrandCSharp } from "react-icons/tb";
import { IconType } from "react-icons";

export interface Education {
  period: string;
  school: string;
  department: string;
  status?: string;
}

export interface Skill {
  name: string;
  icon: IconType;
}

export interface ExperienceSection {
  category: string;
  items: string[];
}

export const educationData: Education[] = [
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
    category: "Tools",
    skills: [
      { name: "Git", icon: SiGit },
    ]
  }
];

export const experienceData: ExperienceSection[] = [
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