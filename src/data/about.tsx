import type { Tech } from "./tech";

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
  tech: Tech;
}

export const educationData: Education[] = [
  {
    period: "Sep 2025 - Present",
    school: "National Taiwan University (NTU)",
    department: "Graduate Institute of Networking and Multimedia (M.S.)"
  },
  {
    period: "Sep 2021 - Jun 2025",
    school: "National Taipei University of Technology (NTUT)",
    department: "Electrical Engineering and Computer Science (B.S.)",
  },
  {
    period: "Sep 2018 - Jun 2021",
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
      "Paper Publication (2nd Author, IEA/AIE 2025) - RANsomCheck: A CNN-Transformer Model for Malware Detection",
      "National Science and Technology Council (NSTC) College/University Student Research (No. 113-2813-C-027-054-E) - Deep Learning Model Based on API Call Sequences for Ransomware Detection (Jul 2024 - Feb 2025)",
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
      { name: "C++", tech: "cplusplus" },
      { name: "C#", tech: "csharp" },
      { name: "Python", tech: "python" },
      { name: "JavaScript", tech: "javascript" },
      { name: "TypeScript", tech: "typescript" },
    ]
  },
  {
    category: "Front End",
    skills: [
      { name: "HTML5", tech: "html5" },
      { name: "CSS3", tech: "css" },
      { name: "React", tech: "react" },
    ]
  },
  {
    category: "Database",
    skills: [
      { name: "MSSQL", tech: "mssql" },
      { name: "PostgreSQL", tech: "postgresql" },
    ]
  },
  {
    category: "Tools & OS",
    skills: [
      { name: "Git", tech: "git" },
      { name: "Linux", tech: "linux" },
    ]
  }
];
